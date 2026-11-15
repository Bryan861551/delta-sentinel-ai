# Methodology

## Pipeline

1. **Acquisition**: products downloaded from NASA Earthdata / ASF (NISAR, OPERA, GPM, SRTM) and Copernicus.
2. **Water mask per date** (`processing/`)
   - OPERA DSWx-S1: pixels with B01_WTR = 1 or 2, cropped to the study area, vectorized.
   - NISAR GCOV: HHHH cropped to the study area, 5×5 block average (reduces speckle), converted to dB,
     water = below the threshold (default −18 dB), patches under 2000 m² removed, vectorized.
3. **Export** (`preparer_appli.py`): one simplified GeoJSON per date, plus `index.json`.
4. **Comparison** (`backend/app/main.py`, `POST /api/compare`)
   - Both masks are rasterized on a common 30 m grid in EPSG:32632.
   - Gain = water on date B and not on date A. Loss = water on A and not on B. Stable = water on both.
   - Areas = pixel count × pixel area. Patches under 2000 m² are dropped; polygons simplified by 20 m.
   - Rain between the two dates = sum of the daily GPM means after date A up to date B.
5. **Visualization**: MapLibre map, before/after swipe, charts, exports (GeoJSON, CSV, print to PDF).

## Classes

| Class | Meaning |
|---|---|
| Water gain | Compatible with a water extension between the two dates |
| Water loss | Compatible with a water retreat |
| Stable water | Water on both dates |

An "uncertain / no data" class is planned (OPERA codes 252-255) but not implemented yet.

## What is not done (and not claimed)

- No supervised model (Random Forest) yet: there are no labelled samples.
- No validation metrics (precision, recall, F1, IoU): they require an independent reference.
- No flood forecast and no alert.
