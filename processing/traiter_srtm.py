import glob, os
import numpy as np
import rasterio
import geopandas as gpd
from rasterio.features import shapes
from rasterio.windows import from_bounds
from shapely.geometry import shape

# Dossier qui contient le fichier SRTM (.hgt ou .tif), a cote de ce script
DOSSIER = "dem"
SORTIE = "geojson_dem"
# Zone du Wouri : ouest, sud, est, nord
BBOX = (9.5, 3.9, 9.95, 4.2)
# Seuils d'altitude en metres : zones "basses" a afficher
SEUILS = [5, 10, 20]

os.makedirs(SORTIE, exist_ok=True)

print("Je cherche dans :", os.path.abspath(DOSSIER))
fichiers = (glob.glob(f"{DOSSIER}/**/*.hgt", recursive=True)
            + glob.glob(f"{DOSSIER}/**/*.tif", recursive=True))
print(len(fichiers), "fichier(s) trouve(s)")
if not fichiers:
    raise SystemExit("Aucun .hgt ou .tif dans le dossier dem (dezippez d'abord).")

chemin = fichiers[0]
print("Utilise :", os.path.basename(chemin))

with rasterio.open(chemin) as src:
    win = from_bounds(*BBOX, transform=src.transform)
    alt = src.read(1, window=win).astype("float32")
    tr = src.window_transform(win)

# valeurs vides SRTM (-32768) -> ignorees
alt[alt < -1000] = np.nan
print("Altitude min / mediane / max (m) :",
      round(float(np.nanmin(alt)), 1),
      round(float(np.nanmedian(alt)), 1),
      round(float(np.nanmax(alt)), 1))

for s in SEUILS:
    # > 0 pour exclure la mer et l'eau plate (altitude 0)
    masque = np.isfinite(alt) & (alt > 0) & (alt <= s)
    if not masque.any():
        print(f"Aucune zone sous {s} m")
        continue
    polys = [shape(g) for g, v in shapes(masque.astype("uint8"),
             mask=masque, transform=tr)]
    gdf = gpd.GeoDataFrame(geometry=polys, crs="EPSG:4326")
    # surface calculee en metres (UTM 32N, Douala)
    gdf["km2"] = (gdf.to_crs(32632).area / 1e6).round(3)
    gdf = gdf[gdf["km2"] > 0.001]
    gdf["geometry"] = gdf.geometry.simplify(0.0002)
    gdf["seuil_m"] = s
    gdf.to_file(f"{SORTIE}/zones_basses_{s}m.geojson", driver="GeoJSON")
    print(f"Sous {s} m :", round(gdf['km2'].sum(), 2), "km2")

print("Resultats dans :", os.path.abspath(SORTIE))
