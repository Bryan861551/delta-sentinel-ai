import glob, os, re
import h5py, numpy as np
import geopandas as gpd
from rasterio.features import shapes
from rasterio.transform import from_origin
from rasterio.warp import transform_bounds
from shapely.geometry import shape

# Dossier qui contient vos fichiers NISAR .h5 (a cote de ce script)
DOSSIER = "nisar"
SORTIE = "geojson_nisar"
# Zone du Wouri : ouest, sud, est, nord
BBOX = (9.5, 3.9, 9.95, 4.2)
# Seuil en dB : en dessous = eau (a ajuster selon l'histogramme)
SEUIL_DB = -18
# On ignore les petites taches (en m2), souvent du bruit
SURFACE_MIN = 2000
# Moyenne par blocs de N x N pixels (5 = bon compromis, 3 = plus de details)
MULTILOOK = 5

import warnings
warnings.filterwarnings("ignore")

os.makedirs(SORTIE, exist_ok=True)

print("Je cherche dans :", os.path.abspath(DOSSIER))
fichiers = sorted(glob.glob(f"{DOSSIER}/**/*.h5", recursive=True))
print(len(fichiers), "fichiers .h5 trouves")

for chemin in fichiers:
    nom = os.path.basename(chemin)
    m = re.search(r"(\d{8})T", nom)
    date = m.group(1) if m else os.path.splitext(nom)[0][-12:]
    print("\n---", nom)

    with h5py.File(chemin, "r") as f:
        racine = "science/LSAR/GCOV/grids/frequencyA"
        if racine not in f:
            print("Structure inattendue. Contenu de science/LSAR :")
            f["science/LSAR"].visit(print)
            continue
        g = f[racine]

        # polarisations disponibles (HHHH, HVHV, VVVV...)
        pols = [k for k in g.keys() if len(k) == 4 and k[:2] == k[2:]]
        print("Polarisations :", pols)
        if not pols:
            continue
        pol = "HHHH" if "HHHH" in pols else pols[0]
        print("Utilise :", pol)

        # systeme de coordonnees
        epsg = int(np.array(g["projection"]).item())
        x = g["xCoordinates"][:]
        y = g["yCoordinates"][:]
        dx = float(np.array(g["xCoordinateSpacing"]).item())
        dy = abs(float(np.array(g["yCoordinateSpacing"]).item()))

        # fenetre correspondant au Wouri
        ouest, sud, est, nord = transform_bounds("EPSG:4326", f"EPSG:{epsg}", *BBOX)
        ix = np.where((x >= ouest) & (x <= est))[0]
        iy = np.where((y >= sud) & (y <= nord))[0]
        if len(ix) == 0 or len(iy) == 0:
            print("Cette scene ne couvre pas la zone du Wouri.")
            continue
        i0, i1 = ix.min(), ix.max() + 1
        j0, j1 = iy.min(), iy.max() + 1

        donnees = g[pol][j0:j1, i0:i1].astype("float32")
        x0 = x[i0] - dx / 2
        y0 = y[j0] + dy / 2

    # moyenne par blocs (multilook) : reduit le bruit et accelere beaucoup
    N = MULTILOOK
    donnees[donnees <= 0] = np.nan
    h = (donnees.shape[0] // N) * N
    w = (donnees.shape[1] // N) * N
    donnees = np.nanmean(donnees[:h, :w].reshape(h // N, N, w // N, N), axis=(1, 3))
    dx, dy = dx * N, dy * N
    print("Taille apres multilook :", donnees.shape)

    # conversion en dB
    db = 10 * np.log10(donnees)
    valide = np.isfinite(db)
    print("dB min/median/max :",
          round(float(np.nanmin(db)), 1),
          round(float(np.nanmedian(db)), 1),
          round(float(np.nanmax(db)), 1))

    eau = valide & (db < SEUIL_DB)
    if not eau.any():
        print(date, ": aucune eau detectee avec le seuil", SEUIL_DB, "dB")
        continue

    tr = from_origin(x0, y0, dx, dy)
    polys = [shape(geom) for geom, v in shapes(eau.astype("uint8"), mask=eau, transform=tr)]
    gdf = gpd.GeoDataFrame(geometry=polys, crs=f"EPSG:{epsg}")
    gdf = gdf[gdf.area > SURFACE_MIN]
    if gdf.empty:
        print(date, ": rien apres filtrage des petites taches")
        continue

    surface_km2 = gdf.area.sum() / 1e6
    gdf = gdf.to_crs(4326)
    gdf["geometry"] = gdf.geometry.simplify(0.0001)
    gdf["date"] = date
    gdf["km2"] = round(surface_km2, 2)
    gdf.to_file(f"{SORTIE}/nisar_water_{date}.geojson", driver="GeoJSON")
    print(date, ":", round(surface_km2, 2), "km2 d'eau")

print("\nResultats dans :", os.path.abspath(SORTIE))
