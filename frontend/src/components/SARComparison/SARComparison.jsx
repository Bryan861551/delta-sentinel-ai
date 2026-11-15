import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { BASE_STYLE, COLORS, toBounds } from "../../mapStyle";
import { getGeoJSON } from "../../services/api";

function makeMap(container, region, geojson, color) {
  const map = new maplibregl.Map({
    container,
    style: BASE_STYLE,
    bounds: toBounds(region.bbox),
    fitBoundsOptions: { padding: 30 },
    attributionControl: false,
  });
  map.on("load", () => {
    map.addSource("water", { type: "geojson", data: geojson });
    map.addLayer({ id: "water", type: "fill", source: "water", paint: { "fill-color": color, "fill-opacity": 0.7 } });
    map.addLayer({ id: "water-line", type: "line", source: "water", paint: { "line-color": color, "line-width": 1 } });
  });
  return map;
}

/** Before/after swipe: two synchronised maps, the "after" map is clipped by a slider. */
export default function SARComparison({ region, sceneA, sceneB, source }) {
  const boxA = useRef(null);
  const boxB = useRef(null);
  const [pos, setPos] = useState(50);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sceneA || !sceneB) return undefined;
    let mapA, mapB, cancelled = false;
    setError("");
    Promise.all([getGeoJSON(sceneA.file), getGeoJSON(sceneB.file)])
      .then(([ga, gb]) => {
        if (cancelled) return;
        mapA = makeMap(boxA.current, region, ga, COLORS.stable_water);
        mapB = makeMap(boxB.current, region, gb, COLORS.water_gain);
        mapB.addControl(new maplibregl.NavigationControl(), "bottom-right");
        let syncing = false;
        const sync = (from, to) => () => {
          if (syncing) return;
          syncing = true;
          to.jumpTo({ center: from.getCenter(), zoom: from.getZoom(), bearing: from.getBearing(), pitch: from.getPitch() });
          syncing = false;
        };
        mapA.on("move", sync(mapA, mapB));
        mapB.on("move", sync(mapB, mapA));
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
      if (mapA) mapA.remove();
      if (mapB) mapB.remove();
    };
  }, [region, sceneA, sceneB]);

  if (!sceneA || !sceneB) return <div className="empty">Choose two dates to open the before/after comparison.</div>;

  return (
    <div className="mapwrap">
      <div className="mapbox" ref={boxA} />
      <div className="mapbox" ref={boxB} style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
      <div className="swipe-handle" style={{ left: `${pos}%` }} />
      <div className="swipe-label" style={{ left: 12 }}>Before · {sceneA.date} · {sceneA.km2} km²</div>
      <div className="swipe-label" style={{ right: 12 }}>After · {sceneB.date} · {sceneB.km2} km²</div>
      <input className="swipe-slider" type="range" min="0" max="100" value={pos} onChange={(e) => setPos(Number(e.target.value))} />
      <div className="legend">
        <div><i style={{ background: COLORS.stable_water }} /> Water, before ({source.toUpperCase()})</div>
        <div><i style={{ background: COLORS.water_gain }} /> Water, after ({source.toUpperCase()})</div>
      </div>
      {error && <div className="error" style={{ position: "absolute", top: 50, left: 12, zIndex: 9 }}>{error}</div>}
    </div>
  );
}
