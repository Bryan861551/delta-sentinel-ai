import glob, os, re
import rasterio, geopandas as gpd
from rasterio.features import shapes
from rasterio.windows import from_bounds
from rasterio.warp import transform_bounds
from shapely.geometry import shape

# Dossier qui contient vos fichiers OPERA dezippes (a cote de ce script)
DOSSIER = "opera"
# Dossier cree automatiquement pour les resultats
SORTIE = "geojson"
# Zone du Wouri : ouest, sud, est, nord
BBOX = (9.5, 3.9, 9.95, 4.2)

os.makedirs(SORTIE, exist_ok=True)

print("Je cherche dans :", os.path.abspath(DOSSIER))
fichiers = sorted(glob.glob(f"{DOSSIER}/**/*B01_WTR.tif", recursive=True))
print(len(fichiers), "fichiers trouves")

for chemin in fichiers:
    m = re.search(r"(\d{8})T", os.path.basename(chemin))
    date = m.group(1) if m else "inconnue"

    with rasterio.open(chemin) as src:
        b = transform_bounds("EPSG:4326", src.crs, *BBOX)
        win = from_bounds(*b, transform=src.transform)
        wtr = src.read(1, window=win)
        tr = src.window_transform(win)

        eau = (wtr == 1) | (wtr == 2)
        if not eau.any():
            print(date, ": aucune eau detectee dans la zone")
            continue

        polys = [shape(g) for g, v in shapes(eau.astype("uint8"),
                 mask=eau, transform=tr)]
        gdf = gpd.GeoDataFrame(geometry=polys, crs=src.crs)

    surface_km2 = gdf.area.sum() / 1e6
    gdf = gdf.to_crs(4326)
    gdf["geometry"] = gdf.geometry.simplify(0.0001)
    gdf["date"] = date
    gdf["km2"] = round(surface_km2, 2)
    gdf.to_file(f"{SORTIE}/water_{date}.geojson", driver="GeoJSON")
    print(date, ":", round(surface_km2, 2), "km2 d'eau")

print("Resultats dans :", os.path.abspath(SORTIE))
