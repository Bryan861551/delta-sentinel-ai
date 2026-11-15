import { COLORS } from "../../mapStyle";

const fmt = (v, d = 2) => (v === null || v === undefined ? "n/a" : Number(v).toFixed(d));

export default function Dashboard({ region, result, source }) {
  if (!result) {
    return (
      <div className="empty">
        <h2 style={{ color: "#e8f0ff" }}>{region.name}</h2>
        Pick a source and two dates in the left panel, then run the comparison.
      </div>
    );
  }
  const s = result.stats;
  const m = result.metadata;
  return (
    <>
      <div className="cards">
        <div className="card"><small>Water, {m.date_a}</small><div className="val">{fmt(s.water_a_km2)} km²</div><div className="sub">{source.toUpperCase()}</div></div>
        <div className="card"><small>Water, {m.date_b}</small><div className="val">{fmt(s.water_b_km2)} km²</div><div className="sub">{source.toUpperCase()}</div></div>
        <div className="card"><small>Water gain</small><div className="val gain">+{fmt(s.gain_km2)} km²</div></div>
        <div className="card"><small>Water loss</small><div className="val loss">−{fmt(s.loss_km2)} km²</div></div>
        <div className="card">
          <small>Net change</small>
          <div className="val">{s.net_change_km2 > 0 ? "+" : ""}{fmt(s.net_change_km2)} km²</div>
          <div className="sub">{s.net_change_pct === null ? "" : `${s.net_change_pct > 0 ? "+" : ""}${s.net_change_pct} %`}</div>
        </div>
        <div className="card">
          <small>Rain between dates (GPM)</small>
          <div className="val">{s.rain_mm_between_dates === null ? "n/a" : `${s.rain_mm_between_dates} mm`}</div>
          <div className="sub">{s.rain_days_count} days, regional ~10 km</div>
        </div>
      </div>
      <div className="panel">
        <h2>Analysis sheet</h2>
        <table>
          <tbody>
            <tr><th>Region</th><td>{m.region}</td></tr>
            <tr><th>Source</th><td>{m.source === "opera" ? "NASA OPERA DSWx-S1 (Sentinel-1, C-band, 30 m)" : "NISAR L2 GCOV (L-band), threshold-based water mask"}</td></tr>
            <tr><th>Dates</th><td>{m.date_a} → {m.date_b}</td></tr>
            <tr><th>Files</th><td>{m.file_a}<br />{m.file_b}</td></tr>
            <tr><th>Method</th><td>{m.method}</td></tr>
            <tr><th>Areas</th><td>{m.area_crs}, patches under {m.min_patch_m2} m² removed, simplification {m.simplify_m} m</td></tr>
          </tbody>
        </table>
        <div className="notice">
          Observed change, not a flood prediction and not an official alert. See the limits tab.
        </div>
      </div>
    </>
  );
}
