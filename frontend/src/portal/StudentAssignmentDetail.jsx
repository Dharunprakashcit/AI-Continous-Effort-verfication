import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import useApi from "../app/useApi";
import { Empty, PageState, Panel } from "../app/ui.jsx";
import { TypePill, fmtDate } from "./AssignmentsPage.jsx";
import CreateTeamForm from "./CreateTeamForm.jsx";

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "None";

function Individual({ data }) {
  const { assignment: a, submission: s, activity } = data;
  return (
    <>
      <div className="grid-2">
        <Panel title="Assignment details" dark>
          <dl className="kv">
            <dt>Description</dt><dd>{a.description}</dd>
            <dt>Assigned</dt><dd>{fmtDate(a.assignedDate)}</dd>
            <dt>Due</dt><dd>{fmtDate(a.dueDate)}</dd>
            <dt>Maximum score</dt><dd>{a.maxScore}</dd>
          </dl>
        </Panel>
        <Panel title="Submission" dark>
          <dl className="kv">
            <dt>Status</dt>
            <dd className={s.submitted ? "status-ok" : "status-bad"}>
              {s.submitted ? (s.late ? "Submitted late" : "Submitted") : "Not submitted"}
            </dd>
            <dt>Submitted on</dt><dd>{s.submitted ? fmtDateTime(s.submittedAt) : "None"}</dd>
            <dt>Score</dt><dd>{s.score != null ? `${s.score}/${a.maxScore}` : "None"}</dd>
            <dt>Attempts</dt><dd>{s.attempts}</dd>
          </dl>
        </Panel>
      </div>

      <div style={{ height: 24 }} />
      <div className="grid-2">
        <Panel title="Comments">
          {s.comments?.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>{s.comments.map((c, i) => <li key={i}>{c}</li>)}</ul>
          ) : (
            <Empty>No comments.</Empty>
          )}
        </Panel>
        <Panel title="Feedback">
          {s.feedback ? <p>{s.feedback}</p> : <Empty>No feedback yet.</Empty>}
        </Panel>
      </div>

      <div style={{ height: 24 }} />
      <Panel title="Activity history, last 14 days" dark>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Day</th><th>Document edits</th><th>Commits</th><th>Messages</th><th>Replies</th></tr></thead>
            <tbody>
              {activity.map((d, i) => (
                <tr key={i}><td>{d.label}</td><td>{d.docEdits}</td><td>{d.commits}</td><td>{d.messages}</td><td>{d.replies}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function Contributed({ id, data, reload }) {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <Panel title="Assignment details" dark>
        <dl className="kv">
          <dt>Description</dt><dd>{data.assignment.description}</dd>
          <dt>Assigned</dt><dd>{fmtDate(data.assignment.assignedDate)}</dd>
          <dt>Due</dt><dd>{fmtDate(data.assignment.dueDate)}</dd>
        </dl>
      </Panel>

      <Panel
        title="Teams"
        dark
        action={
          data.canCreateTeam && !creating ? (
            <button type="button" className="btn small ghost" onClick={() => setCreating(true)}>+ Create Team</button>
          ) : null
        }
      >
        {data.teams.length === 0 ? (
          <Empty>No teams have been created for this assignment yet.</Empty>
        ) : (
          <ul className="rows">
            {data.teams.map((t) => (
              <li key={t.id} className="row-card" style={{ boxShadow: "none", border: "1px solid var(--line)" }}>
                <div className="grow">
                  <div className="title">{t.name}</div>
                  <div className="sub">{t.memberCount} Members{t.isMine ? ", your team" : ""}</div>
                </div>
                <div className="end">
                  {t.isMine ? (
                    <Link className="btn small" to={`/student/assignments/${id}/teams/${t.id}`}>Open team</Link>
                  ) : (
                    <span className="muted">Only members can open a team</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {!data.canCreateTeam && <p className="muted" style={{ marginTop: 12 }}>You are already on a team for this assignment.</p>}
      </Panel>

      {creating && (
        <Panel title="Create Team">
          <CreateTeamForm
            assignmentId={id}
            base="my/assignments"
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

export default function StudentAssignmentDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/my/assignments/${id}`);
  if (loading || error) return <PageState loading={loading} error={error} />;

  return (
    <>
      <Link to="/student/assignments" className="crumb">&larr; All assignments</Link>
      <div className="page-head">
        <div>
          <h1>{data.assignment.title}</h1>
          <p className="sub">{data.assignment.course}, due {fmtDate(data.assignment.dueDate)}</p>
        </div>
        <TypePill type={data.assignment.type} />
      </div>
      {data.kind === "individual" ? <Individual data={data} /> : <Contributed id={id} data={data} reload={reload} />}
    </>
  );
}
