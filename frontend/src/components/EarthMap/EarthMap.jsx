import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { BASE_STYLE, COLORS, EMPTY_FC, toBounds } from "../../mapStyle";
import { getGeoJSON } from "../../services/api";

/** Interactive map: change layer (gain / loss / stable) + low-lying DEM zones. */
export default function EarthMap({ region, result, dem }) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState({ stable_water: true, water_gain: true, water_loss: true, dem5: false, dem10: false, dem20: false });

  useEffect(() => {
    const map = new maplibregl.Map({
      container: box.current,
      style: BASE_STYLE,
      bounds: toBounds(region.bbox),
      fitBoundsOptions: { padding: 30 },
    });
    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    map.on("load", () => {
      map.addSource("change", { type: "geojson", data: EMPTY_FC });
      for (const cls of ["stable_water", "water_loss", "water_gain"]) {
        map.addLayer({
          id: cls, type: "fill", source: "change",
          filter: ["==", ["get", "class"], cls],
          paint: { "fill-color": COLORS[cls], "fill-opacity": 0.65 },
        });
      }
      for (const k of ["dem20", "dem10", "dem5"]) {
        map.addSource(k, { type: "geojson", data: EMPTY_FC });
        map.addLayer({
          id: k, type: "fill", source: k, layout: { visibility: "none" },
          paint: { "fill-color": COLORS[k], "fill-opacity": 0.35 },
        }, "stable_water");
      }
      map.on("click", (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ["water_gain", "water_loss", "stable_water"] })[0];
        if (!f) return;
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`<b>${f.properties.label}</b><br/>Patch area: ${Number(f.properties.km2).toFixed(3)} km²<br/><small>Estimated from simplified polygons, to be verified.</small>`)
          .addTo(map);
      });
      map.on("mousemove", (e) => {
        const hit = map.queryRenderedFeatures(e.point, { layers: ["water_gain", "water_loss", "stable_water"] }).length > 0;
        map.getCanvas().style.cursor = hit ? "pointer" : "";
      });
      setReady(true);
    });
    mapRef.current = map;
    return () => map.remove();
  }, [region]);

  // Change layer data
  useEffect(() => {
    if (!ready) return;
    mapRef.current.getSource("change").setData(result ? result.geojson : EMPTY_FC);
  }, [ready, result]);

  // Layer visibility
  useEffect(() => {
    if (!ready) return;
    for (const [k, v] of Object.entries(show)) {
      mapRef.current.setLayoutProperty(k, "visibility", v ? "visible" : "none");
    }
  }, [ready, show]);

  // Load DEM layers lazily when first switched on
  const loaded = useRef({});
  useEffect(() => {
    if (!ready || !dem) return;
    for (const s of dem) {
      const k = `dem${s.seuil_m}`;
      if (show[k] && !loaded.current[k] && mapRef.current.getSource(k)) {
        loaded.current[k] = true;
        getGeoJSON(s.file).then((g) => mapRef.current.getSource(k).setData(g)).catch(() => (loaded.current[k] = false));
      }
    }
  }, [ready, show, dem]);

  const toggle = (k) => setShow((s) => ({ ...s, [k]: !s[k] }));
  const demAvailable = (m) => (dem || []).some((d) => d.seuil_m === m);

  return (
    <div className="mapwrap">
      <div className="mapbox" ref={box} />
      <div className="sourcebar">
        {result
          ? <>Source: <b>{result.metadata.source.toUpperCase()}</b> · {result.metadata.date_a} → {result.metadata.date_b} · area in {result.metadata.area_crs}</>
          : "Choose two dates and run a comparison to see changes."}
      </div>
      <div className="toggles">
        <h3>Layers</h3>
        {[["water_gain", "Water gain"], ["water_loss", "Water loss"], ["stable_water", "Stable water"]].map(([k, l]) => (
          <label key={k}><input type="checkbox" checked={show[k]} onChange={() => toggle(k)} /> {l}</label>
        ))}
        <h3 style={{ marginTop: 10 }}>Low-lying (SRTM)</h3>
        {[["dem5", 5], ["dem10", 10], ["dem20", 20]].map(([k, m]) => (
          <label key={k} style={{ opacity: demAvailable(m) ? 1 : 0.4 }}>
            <input type="checkbox" disabled={!demAvailable(m)} checked={show[k]} onChange={() => toggle(k)} /> {"< "}{m} m
          </label>
        ))}
      </div>
      <div className="legend">
        <div><i style={{ background: COLORS.water_gain }} /> Water gain</div>
        <div><i style={{ background: COLORS.water_loss }} /> Water loss</div>
        <div><i style={{ background: COLORS.stable_water }} /> Stable water</div>
        <div style={{ color: "#8da2c9" }}>Units: km² (UTM 32N)</div>
      </div>
    </div>
  );
}
