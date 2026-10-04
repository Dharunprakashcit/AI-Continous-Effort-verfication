import React, { useEffect, useState } from "react";
import axios from "axios";
import useApi from "../app/useApi";
import { PageState, Panel, Skeleton, StatCard } from "../app/ui.jsx";
import { CountUp, Donut, HBars, LineChart, RISK_COLOR, colorForScore } from "../app/charts.jsx";
import { IconChart, IconTarget, IconUsers, IconBell } from "../app/icons.jsx";

function ModelPanel() {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    Promise.all([axios.get("/ann/model/info"), axios.get("/ann/model/drift")])
      .then(([i, d]) => setState({ status: "done", info: i.data, drift: d.data }))
      .catch(() => setState({ status: "error" }));
  }, []);

  if (state.status === "loading") return <Skeleton lines={4} />;
  if (state.status === "error") {
    return <p className="muted">The ANN service is not reachable, so model details are unavailable.</p>;
  }

  const { info, drift } = state;
  const items = Object.entries(info.comparison)
    .map(([name, m]) => ({ label: name, value: Number((m.test.roc_auc * 100).toFixed(1)), color: name.startsWith("ANN") ? "#4b7bec" : "#aeb8cc" }))
    .sort((a, b) => b.value - a.value);

  const driftText =
    drift.status === "insufficient_data"
      ? `Not enough live data yet (${drift.live_samples} of ${drift.min_required} predictions).`
      : drift.status === "stable"
      ? "Live inputs match the training data."
      : `Live inputs have drifted in: ${drift.drifted_features.join(", ")}.`;

  return (
    <>
      <HBars items={items} max={100} unit="%" />
      <p className="muted" style={{ marginTop: 14 }}>
        Test ROC-AUC on held-out simulated data. The deployed network is highlighted.
      </p>
      <p style={{ marginTop: 10 }}><strong>Data drift:</strong> {driftText}</p>
    </>
  );
}

export default function Analytics() {
  const { data, error, loading } = useApi("/faculty/analytics");
  if (loading || error) return <PageState loading={loading} error={error} />;

  const { totals, riskDistribution: r, teamComparison, trends } = data;
  const series = trends.map((t) => ({ name: t.name, points: t.points }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p className="sub">Across all of your teams</p>
        </div>
      </div>

      <div className="stats">
        <StatCard tone="blue" icon={<IconUsers />} label="Teams"><CountUp value={totals.teams} /></StatCard>
        <StatCard tone="green" icon={<IconChart />} label="Average contribution">
          <CountUp value={totals.avgContribution} suffix="%" />
        </StatCard>
        <StatCard tone="pink" icon={<IconTarget />} label="High risk students"><CountUp value={totals.atRisk} /></StatCard>
        <StatCard tone="yellow" icon={<IconBell />} label="Students"><CountUp value={totals.students} /></StatCard>
      </div>

      <div className="grid-2">
        <Panel title="Risk distribution">
          <Donut
            centerLabel="students"
            segments={[
              { label: "Low", value: r.LOW, color: RISK_COLOR.LOW },
              { label: "Medium", value: r.MEDIUM, color: RISK_COLOR.MEDIUM },
              { label: "High", value: r.HIGH, color: RISK_COLOR.HIGH },
            ]}
          />
        </Panel>
        <Panel title="Average contribution by team">
          <HBars
            items={teamComparison.map((t) => ({ label: t.name, value: t.avg, color: colorForScore(t.avg) }))}
            unit="%"
          />
        </Panel>
      </div>

      <div style={{ height: 24 }} />
      <Panel title="Contribution trend by team">
        <LineChart series={series} />
      </Panel>

      <Panel title="Prediction model">
        <ModelPanel />
      </Panel>
    </>
  );
}
