# Limitations

- A change in backscatter or in a water mask is an **observed change**, not automatically a flood.
- Urban areas (double bounce), mangroves, dense vegetation, wet soil, wind roughness and acquisition geometry
  all affect radar signals. In Douala and the Wouri mangroves this can create false detections and misses.
- NISAR (L-band) and OPERA DSWx-S1 (derived from Sentinel-1, C-band) respond differently to the same surface.
  Never compare a NISAR date with an OPERA date.
- OPERA DSWx-S1 comes from Sentinel-1: it is a comparison product, not independent ground truth for Sentinel-1 results.
- The NISAR water threshold (−18 dB) is a starting value, not calibrated on field data.
- Masked pixels (cloud, shadow, ocean) are treated as "not water". A scene with many masked pixels underestimates water.
- Different scenes may cover the study area differently; tide level also changes the estuary.
- GPM cells are about 10 km wide: rain is regional context, not a local measurement.
- SRTM measures the top of vegetation and buildings, with a vertical error of several metres; low-lying zones are indications only.
- Areas are estimates computed on a 30 m grid.
- Results are not validated against an independent reference yet; no accuracy figure should be quoted.
- This tool is not an operational forecast or alert system.
