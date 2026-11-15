"""Lighten the GeoJSON files so the web app loads fast.

Reads  data/        (produced by preparer_appli.py)
Writes data_light/  (same structure, smaller files)

Then: rename `data` to `data_originaux` and `data_light` to `data`.
Your original processed files stay untouched until you rename.
"""
import glob
import json
import os
import shutil

import geopandas as gpd
import shapely

SOURCE = "data"
CIBLE = "data_light"
TOLERANCE = 0.0003      # degrees, about 30 m
GRILLE = 0.00001        # coordinate precision, about 1 m
MIN_DEG2 = 2.5e-8       # ~ 300 m2 at this latitude: drops specks

if not os.path.isdir(SOURCE):
    raise SystemExit("Dossier 'data' introuvable. Lancez ce script a cote de 'data'.")

taille_avant = taille_apres = 0
for chemin in sorted(glob.glob(f"{SOURCE}/**/*", recursive=True)):
    if os.path.isdir(chemin):
        continue
    rel = os.path.relpath(chemin, SOURCE)
    sortie = os.path.join(CIBLE, rel)
    os.makedirs(os.path.dirname(sortie), exist_ok=True)
    avant = os.path.getsize(chemin)
    taille_avant += avant

    if chemin.endswith(".geojson"):
        gdf = gpd.read_file(chemin)
        gdf = gdf[gdf.geometry.area > MIN_DEG2].copy()
        gdf["geometry"] = [
            shapely.set_precision(g.simplify(TOLERANCE), GRILLE)
            for g in gdf.geometry
        ]
        gdf = gdf[~gdf.geometry.is_empty]
        # compact JSON
        with open(sortie, "w", encoding="utf-8") as f:
            json.dump(json.loads(gdf.to_json()), f, separators=(",", ":"))
    else:
        shutil.copy(chemin, sortie)

    apres = os.path.getsize(sortie)
    taille_apres += apres
    print(f"{rel}: {avant / 1e6:.1f} Mo -> {apres / 1e6:.1f} Mo")

print(f"\nTotal: {taille_avant / 1e6:.1f} Mo -> {taille_apres / 1e6:.1f} Mo")
print("Si le resultat vous convient : renommez 'data' en 'data_originaux', puis 'data_light' en 'data'.")
