import React, { useState } from "react";
import { Link } from "react-router-dom";
import useApi from "../app/useApi";
import { Empty, PageState, Panel } from "../app/ui.jsx";
import { IconBook } from "../app/icons.jsx";
import { TypePill, fmtDate } from "./AssignmentsPage.jsx";

const FILTERS = [
  ["individual", "Individual"],
  ["team", "Contributed"],
];

function IndividualCard({ a }) {
  return (
    <>
      <div className="grow">
        <div className="title">{a.title}</div>
        <dl className="kv" style={{ marginTop: 8, gridTemplateColumns: "minmax(120px, 160px) minmax(0, 1fr)", gap: "4px 12px" }}>
          <dt>Due date</dt><dd>{fmtDate(a.dueDate)}</dd>
          <dt>Submission</dt>
          <dd className={a.submitted ? "status-ok" : "status-bad"}>
            {a.submitted ? (a.late ? "Submitted late" : "Submitted") : "Not submitted"}
          </dd>
          <dt>Marks</dt><dd>{a.score != null ? `${a.score}/${a.maxScore}` : "Not graded yet"}</dd>
          <dt>Student activity</dt><dd>{a.activity ? `${a.activity.level} (score ${a.activity.score})` : "None recorded"}</dd>
          <dt>Faculty feedback</dt><dd>{a.feedback || "None yet"}</dd>
        </dl>
      </div>
      <div className="end">
        <Link className="btn small" to={`/student/assignments/${a.id}`}>View Activity</Link>
      </div>
    </>
  );
}

function ContributedCard({ a }) {
  return (
    <>
      <div className="grow">
        <div className="title">{a.title}</div>
        <dl className="kv" style={{ marginTop: 8, gridTemplateColumns: "minmax(120px, 160px) minmax(0, 1fr)", gap: "4px 12px" }}>
          <dt>Due date</dt><dd>{fmtDate(a.dueDate)}</dd>
          <dt>Team</dt><dd>{a.team ? a.team.name : "You are not on a team yet"}</dd>
          <dt>Team members</dt><dd>{a.team ? a.team.members.join(", ") : "None"}</dd>
          <dt>Contribution</dt>
          <dd>
            {a.team
              ? a.team.myContribution != null ? `Your estimated contribution is ${a.team.myContribution}%` : "Not enough activity yet"
              : "Create or join a team to see your contribution"}
          </dd>
        </dl>
      </div>
      <div className="end">
        <Link className="btn small" to={`/student/assignments/${a.id}`}>Contribution Analysis</Link>
      </div>
    </>
  );
}

export default function StudentAssignments() {
  const { data, error, loading } = useApi("/my/assignments");
  const [filter, setFilter] = useState("individual");
  if (loading || error) return <PageState loading={loading} error={error} />;

  const shown = data.filter((a) => a.type === filter);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assignments</h1>
          <p className="sub">Advanced Machine Learning, imported from Google Classroom (simulated)</p>
        </div>
      </div>

      <div className="tabs" role="group" aria-label="Filter assignments">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Panel>
          <Empty>
            {data.length === 0
              ? "No assignments yet. Your instructor has not synced Google Classroom."
              : "No assignments in this group."}
          </Empty>
        </Panel>
      ) : (
        <ul className="rows">
          {shown.map((a, i) => (
            <li key={a.id} className="row-card" style={{ animationDelay: `${i * 70}ms`, alignItems: "flex-start" }}>
              <span className="ico"><IconBook /></span>
              {a.type === "individual" ? <IndividualCard a={a} /> : <ContributedCard a={a} />}
              <div><TypePill type={a.type} /></div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
