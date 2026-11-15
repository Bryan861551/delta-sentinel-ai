// Basemap: OpenStreetMap raster tiles (no API key). Keep the attribution visible.
export const BASE_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export const COLORS = {
  stable_water: "#3b82f6",
  water_gain: "#22d3ee",
  water_loss: "#f5b942",
  dem5: "#ef4444",
  dem10: "#f97316",
  dem20: "#facc15",
};

export const EMPTY_FC = { type: "FeatureCollection", features: [] };

// west, south, east, north -> MapLibre bounds
export const toBounds = (bbox) => [
  [bbox[0], bbox[1]],
  [bbox[2], bbox[3]],
];
