import React from "react";
import { Link, useParams } from "react-router-dom";
import useApi from "../app/useApi";
import { PageState, Panel, StatCard } from "../app/ui.jsx";
import { CountUp, Donut, HBars } from "../app/charts.jsx";
import { IconBook, IconTarget, IconUsers } from "../app/icons.jsx";
import { fmtDate } from "./AssignmentsPage.jsx";

export const SHARE_COLORS = ["#4b7bec", "#2e9e5b", "#e0a100", "#8854d0", "#d64545", "#1fa6a6"];

export default function TeamAssignment() {
  const { id, teamId } = useParams();
  const { data, error, loading } = useApi(`/assignments/${id}/teams/${teamId}`);
  if (loading || error) return <PageState loading={loading} error={error} />;

  const { assignment: a, team, rows, submission: s, weights } = data;
  const sorted = [...rows].sort((x, y) => (y.contribution ?? -1) - (x.contribution ?? -1));
  const colored = sorted.map((r, i) => ({ ...r, color: SHARE_COLORS[i % SHARE_COLORS.length] }));

  return (
    <>
      <Link to={`/faculty/assignments/${id}`} className="crumb">&larr; {a.title}</Link>
      <div className="page-head">
        <div>
          <h1>{team.name}</h1>
          <p className="sub">{a.title}</p>
        </div>
      </div>

      <div className="stats">
        <StatCard tone="blue" icon={<IconUsers />} label="Members"><CountUp value={rows.length} /></StatCard>
        <StatCard tone="green" icon={<IconBook />} label="Submission">
          {s.submitted ? (s.late ? "Late" : "On time") : "Not yet"}
        </StatCard>
        <StatCard tone="yellow" icon={<IconTarget />} label="Team score"><CountUp value={s.score ?? null} /></StatCard>
      </div>
      {s.submitted && <p className="muted" style={{ margin: "-8px 0 20px" }}>Submitted {fmtDate(s.submittedAt)}. {s.feedback}</p>}

      <p className="note">
        Estimated contribution score, not an absolute measure of effort. Each share combines{" "}
        {weights.map((w) => `${w.label.toLowerCase()} (${w.weight}%)`).join(", ")}. A team's shares add up to 100%.
      </p>

      <div className="grid-2">
        <Panel title="Share of team contribution">
          <Donut
            centerValue="100%"
            centerLabel="of the team"
            segments={colored.map((r) => ({ label: r.student.name, value: r.contribution ?? 0, color: r.color }))}
          />
        </Panel>
        <Panel title="Contribution by member">
          <HBars
            items={colored.map((r) => ({ label: r.student.name, value: r.contribution, color: r.color }))}
            max={Math.max(50, ...rows.map((r) => r.contribution ?? 0))}
            unit="%"
          />
        </Panel>
      </div>

      <div style={{ height: 24 }} />
      <Panel title="Members" dark>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Contribution</th><th>Tasks</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.student.id} className="row-link">
                  <td>{r.student.name} <span className="muted">({r.student.registerNo})</span></td>
                  <td><strong>{r.contribution != null ? `${r.contribution}%` : "Not enough activity yet"}</strong></td>
                  <td>{r.tasksDone} of {r.tasksTotal} done</td>
                  <td>{r.status}</td>
                  <td><Link className="row-open" to={`/faculty/assignments/${id}/students/${r.student.id}`}>View analysis</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
