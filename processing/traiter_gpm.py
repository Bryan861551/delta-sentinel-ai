import glob, os, re, json
import h5py, numpy as np

# Dossier qui contient vos fichiers GPM (.nc4 ou .nc), a cote de ce script
DOSSIER = "gpm"
SORTIE = "pluie_douala.json"
# Zone du Wouri : ouest, sud, est, nord
BBOX = (9.5, 3.9, 9.95, 4.2)
# Jour considere comme "forte pluie" (mm/jour)
SEUIL_FORTE = 30

print("Je cherche dans :", os.path.abspath(DOSSIER))
fichiers = sorted(glob.glob(f"{DOSSIER}/**/*.nc4", recursive=True)
                  + glob.glob(f"{DOSSIER}/**/*.nc", recursive=True))
print(len(fichiers), "fichiers trouves")

resultats = []
for chemin in fichiers:
    nom = os.path.basename(chemin)
    m = re.search(r"(\d{8})", nom)
    if not m:
        print("Date introuvable dans", nom)
        continue
    d = m.group(1)
    date = f"{d[:4]}-{d[4:6]}-{d[6:]}"

    with h5py.File(chemin, "r") as f:
        if "precipitation" not in f:
            print(nom, ": variable 'precipitation' absente. Contenu :", list(f.keys()))
            continue
        lon = f["lon"][:]
        lat = f["lat"][:]
        p = f["precipitation"][0]   # un seul jour par fichier
        # l'ordre des axes varie : on le deduit des tailles
        if p.shape == (len(lon), len(lat)):
            p = p.T                  # -> (lat, lon)
        p = p.astype("float32")
        p[p < 0] = np.nan            # valeurs vides

    ouest, sud, est, nord = BBOX
    ix = np.where((lon >= ouest) & (lon <= est))[0]
    iy = np.where((lat >= sud) & (lat <= nord))[0]
    if len(ix) == 0 or len(iy) == 0:
        # zone plus petite qu'un pixel : on prend le pixel le plus proche du centre
        ix = [int(np.argmin(abs(lon - (ouest + est) / 2)))]
        iy = [int(np.argmin(abs(lat - (sud + nord) / 2)))]
    valeur = np.nanmean(p[np.ix_(iy, ix)])
    resultats.append({"date": date, "mm": round(float(valeur), 1)})

resultats.sort(key=lambda r: r["date"])

with open(SORTIE, "w") as out:
    json.dump(resultats, out, indent=1)

print("\nDate        mm/jour")
for r in resultats:
    flag = "  <-- forte pluie" if r["mm"] >= SEUIL_FORTE else ""
    print(r["date"], f"{r['mm']:7.1f}", flag)

if resultats:
    total = sum(r["mm"] for r in resultats)
    print("\nTotal sur la periode :", round(total, 1), "mm")
print("Resultats dans :", os.path.abspath(SORTIE))
