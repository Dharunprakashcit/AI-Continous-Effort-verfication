import React from "react";
import useApi from "../app/useApi";
import { Empty, PageState, Panel, RiskPill } from "../app/ui.jsx";
import { HBars, LineChart, Ring, colorForScore } from "../app/charts.jsx";
import { IconTarget } from "../app/icons.jsx";

export function historySeries(history, name = "Contribution score") {
  const asc = [...history].reverse().slice(-8);
  return [
    {
      name,
      color: "#4b7bec",
      points: asc.map((h) => ({
        label: new Date(h.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: h.contributionScore,
      })),
    },
  ];
}

export function Breakdown({ p }) {
  return (
    <HBars
      items={[
        { label: "Edit score", value: p.editScore, color: colorForScore(p.editScore) },
        { label: "Task score", value: p.taskScore, color: colorForScore(p.taskScore) },
        { label: "Communication", value: p.communicationScore, color: colorForScore(p.communicationScore) },
        { label: "ANN risk", value: Math.round(p.annRiskProbability * 100), color: "#8854d0" },
      ]}
    />
  );
}

export default function StudentFeedback() {
  const { data, error, loading } = useApi("/students/me/dashboard");
  if (loading || error) return <PageState loading={loading} error={error} />;

  const p = data.latestPrediction;
  if (!p) {
    return <Panel title="AI feedback"><Empty>No evaluation yet. Log activity to get one.</Empty></Panel>;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>AI feedback</h1>
          <p className="sub">How the system reached your score</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <Ring value={p.contributionScore} size={120} stroke={12} caption="score" />
          <div style={{ marginTop: 6 }}><RiskPill level={p.riskLevel} /></div>
        </div>
      </div>

      <div className="grid-2">
        <Panel title="Score breakdown">
          <Breakdown p={p} />
          <p className="muted" style={{ marginTop: 16 }}>
            The first three are scores out of 100 from separate scorers. ANN risk is the neural network's
            estimated chance of free riding, so lower is better.
          </p>
        </Panel>
        <Panel title="Score over time">
          <LineChart series={historySeries(data.history)} />
        </Panel>
      </div>

      <h2 style={{ fontSize: "1.0625rem", margin: "24px 0 12px" }}>Reasons</h2>
      <ul className="rows">
        {p.explanations.map((note, i) => (
          <li key={i} className="row-card" style={{ animationDelay: `${i * 70}ms` }}>
            <span className="ico"><IconTarget /></span>
            <div className="title">{note}</div>
          </li>
        ))}
        <li className="row-card">
          <span className="ico" style={{ background: "#fdf1cb" }}><IconTarget /></span>
          <div>
            <div className="title">Suggested next step</div>
            <div className="sub">{p.recommendation}</div>
          </div>
        </li>
      </ul>
    </>
  );
}
