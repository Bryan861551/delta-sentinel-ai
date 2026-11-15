import glob, json, os, shutil

# Dossiers de resultats produits par les scripts precedents
SOURCES = {
    "opera": "geojson",
    "nisar": "geojson_nisar",
    "dem": "geojson_dem",
}
PLUIE = "pluie_douala.json"
DATA = "data"


def iso(d):
    d = str(d)
    return f"{d[:4]}-{d[4:6]}-{d[6:8]}" if len(d) == 8 and d.isdigit() else d


os.makedirs(DATA, exist_ok=True)
index = {"opera": [], "nisar": [], "dem": [], "pluie": []}

for nom, dossier in SOURCES.items():
    cible = os.path.join(DATA, nom)
    os.makedirs(cible, exist_ok=True)
    for chemin in sorted(glob.glob(f"{dossier}/*.geojson")):
        fichier = os.path.basename(chemin)
        shutil.copy(chemin, os.path.join(cible, fichier))
        with open(chemin, encoding="utf-8") as f:
            gj = json.load(f)
        props = gj["features"][0]["properties"] if gj.get("features") else {}
        if nom == "dem":
            # km2 total de toutes les zones pour ce seuil
            km2 = round(sum(ft["properties"].get("km2", 0) for ft in gj["features"]), 2)
            index["dem"].append({"seuil_m": props.get("seuil_m"), "km2": km2,
                                 "file": f"{nom}/{fichier}"})
        else:
            km2 = round(sum(ft["properties"].get("km2", 0) for ft in gj["features"][:1]), 2)
            index[nom].append({"date": iso(props.get("date", "")), "km2": km2,
                               "file": f"{nom}/{fichier}"})
    index[nom].sort(key=lambda r: r.get("date", r.get("seuil_m", 0)))
    print(nom, ":", len(index[nom]), "fichiers")

if os.path.exists(PLUIE):
    with open(PLUIE, encoding="utf-8") as f:
        index["pluie"] = json.load(f)
    shutil.copy(PLUIE, os.path.join(DATA, "pluie.json"))
    print("pluie :", len(index["pluie"]), "jours")
else:
    print("pluie_douala.json introuvable (lancez traiter_gpm.py)")

with open(os.path.join(DATA, "index.json"), "w", encoding="utf-8") as f:
    json.dump(index, f, indent=1, ensure_ascii=False)

print("\nTermine. Dossier pret :", os.path.abspath(DATA))
