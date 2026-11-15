import { geojsonUrl, reportUrl } from "../../services/api";

export default function Reports({ result }) {
  if (!result) return <div className="empty">Run a comparison to generate a report.</div>;
  const m = result.metadata;
  const s = result.stats;
  return (
    <>
      <div className="panel" style={{ marginTop: 16 }}>
        <h2>Scientific report: {m.region}</h2>
        <table>
          <tbody>
            <tr><th>Objective</th><td>Detect and quantify changes in water extent between two radar observations.</td></tr>
            <tr><th>Data</th><td>{m.source.toUpperCase()}: {m.file_a} and {m.file_b}</td></tr>
            <tr><th>Dates</th><td>{m.date_a} → {m.date_b}</td></tr>
            <tr><th>Method</th><td>{m.method}</td></tr>
            <tr><th>Projection</th><td>{m.area_crs}</td></tr>
            <tr><th>Results</th><td>
              Water {s.water_a_km2} km² → {s.water_b_km2} km² (net {s.net_change_km2} km²).
              Gain {s.gain_km2} km², loss {s.loss_km2} km², stable {s.stable_km2} km².
            </td></tr>
            <tr><th>Rain context</th><td>{s.rain_mm_between_dates === null ? "No GPM data between the two dates." : `${s.rain_mm_between_dates} mm cumulated over ${s.rain_days_count} days (regional GPM, not local).`}</td></tr>
            <tr><th>Validation</th><td>Not yet validated against an independent reference. No precision/recall/IoU is claimed.</td></tr>
          </tbody>
        </table>
        <div className="exports">
          <a href={geojsonUrl(result.id)}>Export GeoJSON</a>
          <a href={reportUrl(result.id)}>Export report (CSV)</a>
          <a href="#" onClick={(e) => { e.preventDefault(); window.print(); }}>Print / save as PDF</a>
        </div>
      </div>
      <div className="panel">
        <h2>Limits</h2>
        <ul>{m.limits.map((l) => <li key={l}>{l}</li>)}</ul>
      </div>
    </>
  );
}
