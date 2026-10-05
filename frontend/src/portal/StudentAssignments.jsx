import React, { useState } from "react";
import { Link } from "react-router-dom";
import useApi from "../app/useApi";
import { Empty, PageState, Panel } from "../app/ui.jsx";
import { IconBook } from "../app/icons.jsx";
import { TypePill, fmtDate } from "./AssignmentsPage.jsx";

const FILTERS = [
  ["all", "All"],
  ["individual", "Individual Assignments"],
  ["team", "Contributed Assignments"],
];

export default function StudentAssignments() {
  const { data, error, loading } = useApi("/my/assignments");
  const [filter, setFilter] = useState("all");
  if (loading || error) return <PageState loading={loading} error={error} />;

  const shown = data.filter((a) => filter === "all" || a.type === filter);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assignments</h1>
          <p className="sub">Imported from Google Classroom (simulated)</p>
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
            <li key={a.id} className="row-card" style={{ animationDelay: `${i * 70}ms` }}>
              <span className="ico"><IconBook /></span>
              <div className="grow">
                <div className="title">{a.title}</div>
                <div className="sub">Due {fmtDate(a.dueDate)}</div>
                {a.type === "individual" ? (
                  <div className="sub">
                    {a.submitted ? (a.late ? "Submitted late" : "Submitted") : "Not submitted"}
                    {a.score != null ? `, score ${a.score}/${a.maxScore}` : ""}
                  </div>
                ) : (
                  <div className="sub">
                    Team project, {a.teamCount} teams{a.myTeam ? `, you are in ${a.myTeam.name}` : ", you are not on a team yet"}
                  </div>
                )}
              </div>
              <div className="end">
                <TypePill type={a.type} />
                <div style={{ marginTop: 8 }}>
                  <Link className="btn small" to={`/student/assignments/${a.id}`}>
                    {a.type === "individual" ? "View Activity" : "View Teams"}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
