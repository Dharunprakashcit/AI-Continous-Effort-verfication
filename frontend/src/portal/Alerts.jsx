import React, { useState } from "react";
import { Link } from "react-router-dom";
import useApi from "../app/useApi";
import { Empty, PageState, Panel, RiskPill } from "../app/ui.jsx";
import { IconBell } from "../app/icons.jsx";

export default function Alerts() {
  const { data, error, loading } = useApi("/faculty/alerts");
  const [filter, setFilter] = useState("ALL");
  if (loading || error) return <PageState loading={loading} error={error} />;

  const shown = data.filter((a) => filter === "ALL" || a.decision === filter);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Alerts</h1>
          <p className="sub">Students who currently need a nudge or your attention</p>
        </div>
      </div>

      <div className="tabs" role="group" aria-label="Filter alerts">
        {[["ALL", "All"], ["ALERT", "Alert"], ["NUDGE", "Nudge"]].map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Panel><Empty>Nothing needs attention right now.</Empty></Panel>
      ) : (
        <ul className="rows">
          {shown.map((a, i) => (
            <li key={a._id} className="row-card" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="ico" style={{ background: a.decision === "ALERT" ? "#fbdede" : "#fcefc4" }}>
                <IconBell />
              </span>
              <div>
                <div className="title">
                  <Link to={`/faculty/students/${a.student._id}`}>{a.student.name}</Link>
                  <span className="muted"> in {a.team.name}</span>
                </div>
                <div className="sub">{a.reason}</div>
              </div>
              <div className="end">
                <RiskPill level={a.riskLevel} />
                <div className="sub">{a.decision === "ALERT" ? "Alert faculty" : "Nudge student"}, {a.contributionScore}%</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
