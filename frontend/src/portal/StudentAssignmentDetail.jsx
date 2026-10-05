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
            <dt>Marks</dt><dd>{s.score != null ? `${s.score}/${a.maxScore}` : "Not graded yet"}</dd>
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
        <Panel title="Faculty feedback">
          {s.feedback ? <p>{s.feedback}</p> : <Empty>No feedback yet.</Empty>}
        </Panel>
      </div>

      <div style={{ height: 24 }} />
      <Panel title="Student activity, last 14 days" dark>
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
  const team = data.myTeam;

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
        title={team ? team.name : "Your team"}
        dark
        action={
          <button
            type="button"
            className="btn small ghost"
            disabled={!data.canCreateTeam || creating}
            onClick={() => setCreating(true)}
          >
            + Create Team
          </button>
        }
      >
        {team ? (
          <>
            <p className="note">
              Contribution is an estimate calculated by the system from recorded activity. It is not entered by
              students and is not a grade.
            </p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Student</th><th>Contribution</th><th></th></tr></thead>
                <tbody>
                  {team.members.map((m) => (
                    <tr key={m.id} className="row-link">
                      <td>{m.name}{m.isMe && <span className="muted"> (you)</span>}</td>
                      <td><strong>{m.contribution != null ? `${m.contribution}%` : "Not enough activity yet"}</strong></td>
                      <td><Link className="row-open" to={`/student/assignments/${id}/members/${m.id}`}>Contribution Analysis</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              You are already on a team for this assignment, so a new team cannot be created.
            </p>
          </>
        ) : (
          <Empty>You are not on a team for this assignment yet. Use Create Team to form one.</Empty>
        )}
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

      {data.otherTeams.length > 0 && (
        <Panel title="Other teams">
          <ul className="rows" style={{ gap: 8 }}>
            {data.otherTeams.map((t) => (
              <li key={t.id} className="inline-row">
                <strong>{t.name}</strong>
                <span className="muted">{t.memberCount} Members</span>
              </li>
            ))}
          </ul>
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
