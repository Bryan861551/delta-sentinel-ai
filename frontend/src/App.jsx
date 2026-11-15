import { useEffect, useMemo, useState } from "react";
import { compare, getDatasets, getRegion } from "./services/api";
import Dashboard from "./components/Dashboard/Dashboard";
import Analytics from "./components/Dashboard/Analytics";
import EarthMap from "./components/EarthMap/EarthMap";
import SARComparison from "./components/SARComparison/SARComparison";
import AIAnalysis from "./components/AIAnalysis/AIAnalysis";
import Reports from "./components/Reports/Reports";

const TABS = [
  ["dashboard", "Dashboard"],
  ["map", "Map"],
  ["compare", "SAR Comparison"],
  ["ai", "Detection & limits"],
  ["analytics", "Analytics"],
  ["report", "Reports"],
];

export default function App() {
  const [region, setRegion] = useState(null);
  const [datasets, setDatasets] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [source, setSource] = useState("opera");
  const [dateA, setDateA] = useState("");
  const [dateB, setDateB] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getRegion(), getDatasets()])
      .then(([r, d]) => { setRegion(r); setDatasets(d); })
      .catch((e) => setLoadError(
        e.name === "AbortError"
          ? "The backend did not answer within 20 seconds (it is probably still busy or frozen). Close its window, then start start_backend.bat again."
          : e.message
      ));
  }, []);

  const scenes = datasets ? datasets[source] || [] : [];
  const dates = useMemo(() => scenes.map((s) => s.date).filter(Boolean), [scenes]);

  // Default to the first and last dates available for the chosen source
  useEffect(() => {
    setResult(null);
    setError("");
    setDateA(dates[0] || "");
    setDateB(dates.length > 1 ? dates[dates.length - 1] : "");
  }, [source, datasets]); // eslint-disable-line react-hooks/exhaustive-deps

  const sceneA = scenes.find((s) => s.date === dateA);
  const sceneB = scenes.find((s) => s.date === dateB);
  const [earlier, later] = dateA <= dateB ? [sceneA, sceneB] : [sceneB, sceneA];

  async function run() {
    setBusy(true);
    setError("");
    try {
      setResult(await compare(source, dateA, dateB));
      setTab("map");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="empty">
        <h2 style={{ color: "#e8f0ff" }}>Backend unreachable or data missing</h2>
        <p>{loadError}</p>
        <p>Start the API (see README) and make sure the <code>data/</code> folder with <code>index.json</code> is in place.</p>
      </div>
    );
  }
  if (!region || !datasets) return <div className="empty">Loading…</div>;

  const canRun = dateA && dateB && dateA !== dateB && !busy;
  const dem = datasets.dem || [];

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <b>DELTA <span>SENTINEL</span> AI</b>
          <small>Radar change detection · {region.name}</small>
        </div>
        <nav className="tabs">
          {TABS.map(([k, l]) => (
            <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
      </header>

      <div className="layout">
        <aside className="side">
          <h3>Study</h3>
          <label>Study area</label>
          <select value={region.id} disabled><option>{region.name}</option></select>

          <label>Radar source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="opera">OPERA DSWx-S1 (Sentinel-1)</option>
            <option value="nisar">NISAR L2 GCOV (L-band)</option>
          </select>

          <label>Date A (before)</label>
          <select value={dateA} onChange={(e) => { setDateA(e.target.value); setResult(null); }}>
            {dates.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <label>Date B (after)</label>
          <select value={dateB} onChange={(e) => { setDateB(e.target.value); setResult(null); }}>
            <option value="">–</option>
            {dates.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <button className="primary" disabled={!canRun} onClick={run}>
            {busy ? "Computing… (up to 1 min)" : "Compare these two dates"}
          </button>
          {busy && <div className="hint">Progress is printed in the backend window ([compare] lines).</div>}
          {dates.length < 2 && <div className="hint">Fewer than two scenes found for this source. Process more dates first.</div>}
          {error && <div className="error">{error}</div>}

          <div className="notice">
            Compare dates from the same source only. NISAR (L-band) and Sentinel-1 / OPERA (C-band) are not equivalent.
            Results show observed changes, not flood predictions.
          </div>
          <div className="hint">
            {scenes.length} scene(s) for {source.toUpperCase()}. Data: NASA / ASF, Copernicus. Basemap © OpenStreetMap contributors.
          </div>
        </aside>

        <main className="content">
          {tab === "dashboard" && <Dashboard region={region} result={result} source={source} />}
          {tab === "map" && <EarthMap region={region} result={result} dem={dem} />}
          {tab === "compare" && <SARComparison region={region} sceneA={earlier} sceneB={later} source={source} />}
          {tab === "ai" && <AIAnalysis result={result} />}
          {tab === "analytics" && <Analytics datasets={datasets} source={source} result={result} />}
          {tab === "report" && <Reports result={result} />}
        </main>
      </div>
    </div>
  );
}
