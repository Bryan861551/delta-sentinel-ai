import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COLORS } from "../../mapStyle";

const tip = { background: "#0b1736", border: "1px solid #1c3166", color: "#e8f0ff", fontSize: 12 };

export default function Analytics({ datasets, source, result }) {
  const series = (datasets[source] || []).map((s) => ({ date: s.date, km2: s.km2 }));
  const rain = datasets.pluie || [];
  const classes = result
    ? [
        { name: "Gain", km2: result.stats.gain_km2, fill: COLORS.water_gain },
        { name: "Loss", km2: result.stats.loss_km2, fill: COLORS.water_loss },
        { name: "Stable", km2: result.stats.stable_km2, fill: COLORS.stable_water },
      ]
    : [];

  return (
    <>
      <div className="panel" style={{ marginTop: 16 }}>
        <h2>Water surface per date ({source.toUpperCase()}, km²)</h2>
        {series.length ? (
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={series}>
                <CartesianGrid stroke="#1c3166" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#8da2c9" fontSize={11} />
                <YAxis stroke="#8da2c9" fontSize={11} unit=" km²" width={70} />
                <Tooltip contentStyle={tip} />
                <Line type="monotone" dataKey="km2" name="Water (km²)" stroke={COLORS.water_gain} strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="hint">No scene available.</div>}
        <div className="hint">Surfaces from different scenes also depend on tile coverage, masked pixels and tide; compare with care.</div>
      </div>

      <div className="panel">
        <h2>Daily rain, Douala area (GPM IMERG, mm/day)</h2>
        {rain.length ? (
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={rain}>
                <CartesianGrid stroke="#1c3166" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#8da2c9" fontSize={11} />
                <YAxis stroke="#8da2c9" fontSize={11} unit=" mm" width={60} />
                <Tooltip contentStyle={tip} />
                <Bar dataKey="mm" name="Rain (mm/day)" fill={COLORS.water_loss} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="hint">pluie_douala.json not found in data/ (run traiter_gpm.py then preparer_appli.py).</div>}
        <div className="hint">GPM cells are about 10 km wide: this is regional context, not a local measurement.</div>
      </div>

      {result && (
        <div className="panel">
          <h2>Area by class ({result.metadata.date_a} → {result.metadata.date_b})</h2>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={classes}>
                <CartesianGrid stroke="#1c3166" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#8da2c9" fontSize={11} />
                <YAxis stroke="#8da2c9" fontSize={11} unit=" km²" width={70} />
                <Tooltip contentStyle={tip} />
                <Legend />
                <Bar dataKey="km2" name="Area (km²)">
                  {classes.map((c) => <Cell key={c.name} fill={c.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );
}
