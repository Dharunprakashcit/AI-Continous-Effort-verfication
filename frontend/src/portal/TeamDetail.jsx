import React from "react";
import { Link, useParams } from "react-router-dom";
import useApi from "../app/useApi";
import { PageState, Panel, RiskPill, StatCard } from "../app/ui.jsx";
import { CountUp, HBars, LineChart, Ring, StackedBars, colorForScore } from "../app/charts.jsx";
import { IconTarget, IconUsers, IconBell } from "../app/icons.jsx";
import { ACTIVITY_SERIES } from "./StudentOverview.jsx";

export default function TeamDetail() {
  const { teamId } = useParams();
  const { data, error, loading } = useApi(`/faculty/teams/${teamId}/overview`);
  if (loading || error) return <PageState loading={loading} error={error} />;

  const { team, rows, avgContribution, trend, activityByDay } = data;
  const attention = rows.filter((r) => r.riskLevel === "MEDIUM" || r.riskLevel === "HIGH").length;
  const sorted = [...rows].sort((a, b) => (b.contributionScore ?? -1) - (a.contributionScore ?? -1));

  return (
    <>
      <Link to="/faculty/teams" className="crumb">&larr; All teams</Link>
      <div className="profile">
        <div>
          <h1 style={{ fontSize: "1.75rem" }}>{team.name}</h1>
          <p className="meta">{team.projectTitle}</p>
        </div>
        <Ring value={avgContribution} caption="team average" />
      </div>

      <div className="stats">
        <StatCard tone="blue" icon={<IconUsers />} label="Members"><CountUp value={rows.length} /></StatCard>
        <StatCard tone="yellow" icon={<IconBell />} label="Need attention"><CountUp value={attention} /></StatCard>
        <StatCard tone="green" icon={<IconTarget />} label="Doing well">
          <CountUp value={rows.length - attention} />
        </StatCard>
      </div>

      <div className="grid-2">
        <Panel title="Contribution by member">
          <HBars
            items={sorted.map((r) => ({
              label: r.student.name,
              value: r.contributionScore,
              color: colorForScore(r.contributionScore),
            }))}
            unit="%"
          />
        </Panel>
        <Panel title="Team average over time">
          <LineChart series={[{ name: "Team average", color: "#4b7bec", points: trend }]} />
        </Panel>
      </div>

      <div style={{ height: 24 }} />
      <Panel title="Team activity, last 7 days">
        <StackedBars data={activityByDay} series={ACTIVITY_SERIES} />
      </Panel>

      <Panel title="Members" dark>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Contribution</th><th>Risk</th><th>Decision</th><th></th></tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.student.id} className="row-link">
                  <td>{r.student.name} <span className="muted">({r.student.registerNo})</span></td>
                  <td>{r.contributionScore != null ? `${r.contributionScore}%` : "N/A"}</td>
                  <td><RiskPill level={r.riskLevel} /></td>
                  <td>{r.decision || "None"}</td>
                  <td><Link className="row-open" to={`/faculty/students/${r.student.id}`}>View detail</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
