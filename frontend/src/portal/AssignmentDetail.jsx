import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import CreateTeamForm from "./CreateTeamForm.jsx";
import useApi from "../app/useApi";
import { PageState, Panel, StatCard } from "../app/ui.jsx";
import { CountUp } from "../app/charts.jsx";
import { IconBook, IconTarget, IconUsers } from "../app/icons.jsx";
import { TypePill, fmtDate } from "./AssignmentsPage.jsx";

function Header({ a }) {
  return (
    <>
      <Link to="/faculty" className="crumb">&larr; All assignments</Link>
      <div className="page-head">
        <div>
          <h1>{a.title}</h1>
          <p className="sub">{a.course}</p>
        </div>
        <TypePill type={a.type} />
      </div>
      <Panel>
        <dl className="kv">
          <dt>Description</dt><dd>{a.description}</dd>
          <dt>Assigned</dt><dd>{fmtDate(a.assignedDate)}</dd>
          <dt>Due</dt><dd>{fmtDate(a.dueDate)}</dd>
          <dt>Maximum score</dt><dd>{a.maxScore}</dd>
        </dl>
      </Panel>
    </>
  );
}

function Individual({ id, data }) {
  const { rows } = data;
  const submitted = rows.filter((r) => r.submitted);
  const late = submitted.filter((r) => r.late).length;
  const scores = submitted.filter((r) => r.score != null).map((r) => r.score);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return (
    <>
      <div className="stats">
        <StatCard tone="blue" icon={<IconUsers />} label="Submitted"><CountUp value={submitted.length} />/{rows.length}</StatCard>
        <StatCard tone="yellow" icon={<IconBook />} label="Late"><CountUp value={late} /></StatCard>
        <StatCard tone="green" icon={<IconTarget />} label="Average score"><CountUp value={avg} /></StatCard>
      </div>
      <Panel title="Students" dark>
        <p className="muted" style={{ marginBottom: 12 }}>
          This is individual work, so contribution is 100% when the student submitted and 0% when not.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Submitted</th><th>Score</th><th>Late</th><th>Attempts</th><th>Contribution</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student.id} className="row-link">
                  <td>{r.student.name} <span className="muted">({r.student.registerNo})</span></td>
                  <td className={r.submitted ? "status-ok" : "status-bad"}>{r.submitted ? "Yes" : "No"}</td>
                  <td>{r.score ?? "None"}</td>
                  <td>{r.submitted ? (r.late ? "Late" : "On time") : "None"}</td>
                  <td>{r.attempts}</td>
                  <td>{r.contribution}%</td>
                  <td><Link className="row-open" to={`/faculty/assignments/${id}/students/${r.student.id}`}>View detail</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function TeamList({ id, data, reload }) {
  const { rows, weights } = data;
  const [creating, setCreating] = useState(false);
  return (
    <>
      <p className="note">
        Contribution shares are estimates built from {weights.map((w) => `${w.key} ${w.weight}%`).join(", ")}.
        They are not a measure of effort. The spread column shows the gap between the largest and smallest share
        in each team.
      </p>
      <Panel
        title="Teams"
        dark
        action={!creating ? <button type="button" className="btn small ghost" onClick={() => setCreating(true)}>+ Create Team</button> : null}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Team</th><th>Members</th><th>Submitted</th><th>Score</th><th>Largest share</th><th>Smallest share</th><th>Spread</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.team.id} className="row-link">
                  <td>{r.team.name}</td>
                  <td>{r.memberCount}</td>
                  <td className={r.submitted ? "status-ok" : ""}>{r.submitted ? (r.late ? "Late" : "Yes") : "Not yet"}</td>
                  <td>{r.score ?? "None"}</td>
                  <td>{r.highest ? `${r.highest.name} ${r.highest.share}%` : "None"}</td>
                  <td>{r.lowest ? `${r.lowest.name} ${r.lowest.share}%` : "None"}</td>
                  <td>{r.spread != null ? `${r.spread} points` : "None"}</td>
                  <td><Link className="row-open" to={`/faculty/assignments/${id}/teams/${r.team.id}`}>View team</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {creating && (
        <Panel title="Create Team">
          <CreateTeamForm
            assignmentId={id}
            base="assignments"
            onCancel={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              reload();
            }}
          />
        </Panel>
      )}
    </>
  );
}

export default function AssignmentDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/assignments/${id}`);
  if (loading || error) return <PageState loading={loading} error={error} />;

  return (
    <>
      <Header a={data.assignment} />
      <div style={{ height: 24 }} />
      {data.assignment.type === "individual" ? <Individual id={id} data={data} /> : <TeamList id={id} data={data} reload={reload} />}
    </>
  );
}
