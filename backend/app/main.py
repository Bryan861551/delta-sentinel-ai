"""DELTA SENTINEL AI - backend API (FastAPI).

Serves the pre-processed results (data/ folder produced by preparer_appli.py)
and computes a before/after water change map between two dates.

The comparison is done on a regular metric grid (raster), not with polygon
set operations: it takes seconds even when the GeoJSON files are heavy.
"""
import csv
import io
import json
import math
import os
import time
from pathlib import Path

import geopandas as gpd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from rasterio.features import rasterize, shapes
from rasterio.transform import from_origin
from shapely.geometry import box, shape

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("DATA_DIR", ROOT / "data"))

AREA_CRS = "EPSG:32632"   # UTM 32N: metric projection used for every area
GRID_M = float(os.environ.get("GRID_M", 30))  # grid resolution in metres
MIN_AREA_M2 = 2000        # tiny patches (noise) are dropped
SIMPLIFY_M = 20           # simplification tolerance in metres

REGION = {
    "id": "wouri",
    "name": "Wouri Estuary, Douala, Cameroon",
    "bbox": [9.5, 3.9, 9.95, 4.2],  # west, south, east, north
}

CLASSES = {
    "stable_water": {"label": "Stable water"},
    "water_gain": {"label": "Water gain (compatible with water extension)"},
    "water_loss": {"label": "Water loss (compatible with water retreat)"},
}

LIMITS = [
    "A change in radar backscatter is not automatically a flood.",
    "Urban areas, mangroves, vegetation and soil moisture also affect the signal.",
    "NISAR (L-band) and OPERA DSWx-S1 (Sentinel-1, C-band) are not directly equivalent: compare dates within one source.",
    "Pixels masked as cloud, shadow or no-data are not water and are not reported as uncertain here.",
    "OPERA is a comparison product derived from Sentinel-1, not independent ground truth.",
    f"Areas are computed on a {GRID_M:g} m grid in {AREA_CRS}; they are estimates.",
]

app = FastAPI(title="Delta Sentinel AI API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if DATA_DIR.exists():
    app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")

RESULTS: dict = {}


def load_index() -> dict:
    path = DATA_DIR / "index.json"
    if not path.exists():
        raise HTTPException(
            503,
            "data/index.json not found. Run preparer_appli.py and copy the 'data' "
            "folder next to 'backend' (see README).",
        )
    return json.loads(path.read_text(encoding="utf-8"))


def find_scene(index: dict, source: str, date: str) -> dict:
    for scene in index.get(source, []):
        if scene.get("date") == date:
            return scene
    raise HTTPException(404, f"No {source} scene for date {date}.")


def make_grid():
    """Metric grid covering the study area."""
    minx, miny, maxx, maxy = (
        gpd.GeoSeries([box(*REGION["bbox"])], crs=4326).to_crs(AREA_CRS).total_bounds
    )
    width = int(math.ceil((maxx - minx) / GRID_M))
    height = int(math.ceil((maxy - miny) / GRID_M))
    return from_origin(minx, maxy, GRID_M, GRID_M), (height, width)


def water_mask(rel_file: str, transform, shape_hw) -> np.ndarray:
    """Rasterize a water GeoJSON on the grid (True = water)."""
    path = (DATA_DIR / rel_file).resolve()
    if DATA_DIR.resolve() not in path.parents or not path.exists():
        raise HTTPException(404, f"File not found: {rel_file}")
    gdf = gpd.read_file(path)
    if gdf.crs is None:
        gdf = gdf.set_crs(4326)
    gdf = gdf.to_crs(AREA_CRS)
    geoms = [(g, 1) for g in gdf.geometry if g is not None and not g.is_empty]
    if not geoms:
        return np.zeros(shape_hw, dtype=bool)
    arr = rasterize(geoms, out_shape=shape_hw, transform=transform, fill=0, dtype="uint8")
    return arr.astype(bool)


MASKS: dict = {}  # rasterized scenes are kept in memory: a scene is read only once


def get_mask(rel_file: str, transform, shape_hw) -> np.ndarray:
    if rel_file not in MASKS:
        MASKS[rel_file] = water_mask(rel_file, transform, shape_hw)
    return MASKS[rel_file]


def polygonize(mask: np.ndarray, transform, cls: str) -> list:
    """Mask -> list of rows (class, label, km2, geometry), small patches removed."""
    rows = []
    if not mask.any():
        return rows
    for geom, _ in shapes(mask.astype("uint8"), mask=mask, transform=transform):
        poly = shape(geom)
        area = poly.area
        if area < MIN_AREA_M2:
            continue
        rows.append({
            "class": cls,
            "label": CLASSES[cls]["label"],
            "km2": round(area / 1e6, 4),
            "geometry": poly.simplify(SIMPLIFY_M),
        })
    return rows


class CompareRequest(BaseModel):
    source: str   # "opera" or "nisar"
    date_a: str   # one date, YYYY-MM-DD
    date_b: str   # the other date, YYYY-MM-DD


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/regions")
def regions():
    return [REGION]


@app.get("/api/datasets")
def datasets():
    return load_index()


@app.get("/api/rain")
def rain():
    return load_index().get("pluie", [])


@app.post("/api/compare")
def compare(req: CompareRequest):
    if req.source not in ("opera", "nisar"):
        raise HTTPException(400, "source must be 'opera' or 'nisar'")
    if req.date_a == req.date_b:
        raise HTTPException(400, "Choose two different dates.")
    date_a, date_b = sorted([req.date_a, req.date_b])

    result_id = f"{req.source}_{date_a}_{date_b}"
    if result_id in RESULTS:
        return RESULTS[result_id]

    t0 = time.time()
    print(f"[compare] {result_id}: start", flush=True)
    index = load_index()
    scene_a = find_scene(index, req.source, date_a)
    scene_b = find_scene(index, req.source, date_b)

    transform, shape_hw = make_grid()
    print(f"[compare] grid {shape_hw[1]} x {shape_hw[0]} px at {GRID_M:g} m", flush=True)
    a = get_mask(scene_a["file"], transform, shape_hw)
    print(f"[compare] scene A rasterized ({time.time() - t0:.1f}s)", flush=True)
    b = get_mask(scene_b["file"], transform, shape_hw)
    print(f"[compare] scene B rasterized ({time.time() - t0:.1f}s)", flush=True)

    parts = {
        "stable_water": a & b,
        "water_gain": b & ~a,
        "water_loss": a & ~b,
    }
    rows = []
    for cls, mask in parts.items():
        rows += polygonize(mask, transform, cls)
    print(f"[compare] polygonized: {len(rows)} patches ({time.time() - t0:.1f}s)", flush=True)

    if rows:
        fc = json.loads(
            gpd.GeoDataFrame(rows, geometry="geometry", crs=AREA_CRS).to_crs(4326).to_json()
        )
    else:
        fc = {"type": "FeatureCollection", "features": []}

    px_km2 = (GRID_M * GRID_M) / 1e6

    def total(cls):
        return round(float(parts[cls].sum()) * px_km2, 3)

    water_a = round(float(a.sum()) * px_km2, 3)
    water_b = round(float(b.sum()) * px_km2, 3)
    net = round(water_b - water_a, 3)
    rain_days = [r for r in index.get("pluie", []) if date_a < r["date"] <= date_b]

    result = {
        "id": result_id,
        "metadata": {
            "region": REGION["name"],
            "source": req.source,
            "date_a": date_a,
            "date_b": date_b,
            "file_a": scene_a["file"],
            "file_b": scene_b["file"],
            "method": f"Water masks rasterized on a {GRID_M:g} m grid, then per-pixel comparison between dates",
            "area_crs": AREA_CRS,
            "min_patch_m2": MIN_AREA_M2,
            "simplify_m": SIMPLIFY_M,
            "limits": LIMITS,
        },
        "stats": {
            "water_a_km2": water_a,
            "water_b_km2": water_b,
            "gain_km2": total("water_gain"),
            "loss_km2": total("water_loss"),
            "stable_km2": total("stable_water"),
            "net_change_km2": net,
            "net_change_pct": round(100 * net / water_a, 1) if water_a else None,
            "rain_mm_between_dates": round(sum(r["mm"] for r in rain_days), 1) if rain_days else None,
            "rain_days_count": len(rain_days),
        },
        "geojson": fc,
    }
    RESULTS[result_id] = result
    print(f"[compare] {result_id}: done in {time.time() - t0:.1f}s", flush=True)
    return result


@app.get("/api/results/{result_id}")
def get_result(result_id: str):
    if result_id not in RESULTS:
        raise HTTPException(404, "Unknown result. Run a comparison first.")
    return RESULTS[result_id]


@app.get("/api/results/{result_id}/geojson")
def get_result_geojson(result_id: str):
    result = get_result(result_id)
    return Response(
        content=json.dumps(result["geojson"]),
        media_type="application/geo+json",
        headers={"Content-Disposition": f'attachment; filename="{result_id}.geojson"'},
    )


@app.get("/api/report/{result_id}")
def get_report(result_id: str):
    result = get_result(result_id)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["section", "key", "value"])
    for k, v in result["metadata"].items():
        if k == "limits":
            for lim in v:
                w.writerow(["limit", "", lim])
        else:
            w.writerow(["metadata", k, v])
    for k, v in result["stats"].items():
        w.writerow(["stats", k, v])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{result_id}_report.csv"'},
    )


# Optional single-URL mode: after `npm run build` in frontend/, the API also serves the site.
_DIST = ROOT / "frontend" / "dist"
if _DIST.exists():
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="site")
