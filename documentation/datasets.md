# Datasets

| Source | Product | Role in the project | Status |
|---|---|---|---|
| NASA/ISRO NISAR | L2 GCOV (HDF5), HHHH and HVHV | L-band water mask: HHHH power converted to dB, multilook 5×5, water below a threshold (default −18 dB) | Used, 3 scenes |
| NASA OPERA | L3 DSWx-S1, layer B01_WTR | Water extent derived from Sentinel-1. Classes 1 (open water) and 2 (partial water) are kept; 0 is not water; 252-255 are masked or no data | Used |
| NASA GPM | IMERG Late daily V07, variable `precipitation` | Regional rain context, mean of the 0.1° cells over the study area | Used |
| NASA SRTM | SRTMGL1 1 arc-second DEM, tile N04E009 | Low-lying zones below 5, 10 and 20 m (excluding 0 m) | Used |
| Copernicus Sentinel-1 | GRD (downloaded) | Planned complementary C-band pipeline (SNAP: orbit, calibration, speckle, terrain correction, dB) | Downloaded, not yet integrated |
| Copernicus Sentinel-2 | L2A | Optical visual check | Not used |

Raw files are not stored in the repository (tens of GB). The traceability of each result is kept in
`data/index.json` and in the report: file names, dates, method, projection.

## Study area

Wouri estuary, Douala, Cameroon. Bounding box (west, south, east, north): 9.5, 3.9, 9.95, 4.2 (EPSG:4326).
Areas are computed in EPSG:32632 (UTM zone 32N).

## Rules applied

- Two dates are compared only within the same source.
- NISAR (L-band) and Sentinel-1 / OPERA (C-band) are not treated as equivalent.
- Every figure shown in the app comes from a real run of the pipeline on these files. No demo data is shipped.
