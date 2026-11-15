import { COLORS } from "../../mapStyle";

const CLASS_TABLE = [
  ["water_gain", "Change compatible with water extension", "Pixels that are water on the later date but not on the earlier one."],
  ["water_loss", "Change compatible with water retreat", "Pixels that were water on the earlier date but not on the later one."],
  ["stable_water", "Stable water", "Water on both dates."],
];

export default function AIAnalysis({ result }) {
  return (
    <>
      <div className="panel" style={{ marginTop: 16 }}>
        <h2>Detection classes</h2>
        <table>
          <thead><tr><th></th><th>Class</th><th>Meaning</th><th>Area (km²)</th></tr></thead>
          <tbody>
            {CLASS_TABLE.map(([k, name, desc]) => (
              <tr key={k}>
                <td><i style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, background: COLORS[k] }} /></td>
                <td>{name}</td>
                <td>{desc}</td>
                <td>{result ? result.stats[k === "water_gain" ? "gain_km2" : k === "water_loss" ? "loss_km2" : "stable_km2"] : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="hint">
          Current method: explicit change indicators between two water masks (no supervised model yet).
          No confidence score is shown because no reference data has been used to validate the masks.
          Validation metrics (precision, recall, F1, IoU) will appear here once an independent reference is available.
        </div>
      </div>
      <div className="panel">
        <h2>Limits and uncertainty</h2>
        <ul>
          {(result ? result.metadata.limits : [
            "Run a comparison to see the limits that apply to it.",
          ]).map((l) => <li key={l}>{l}</li>)}
        </ul>
      </div>
    </>
  );
}
