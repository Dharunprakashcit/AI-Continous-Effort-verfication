import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../AuthContext.jsx";
import RiskBadge from "../components/RiskBadge.jsx";
import ModelInsights from "../components/ModelInsights.jsx";

export default function FacultyDashboard() {
  const { user, logout } = useAuth();
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);

  async function load() {
    const { data: teams } = await api.get("/faculty/teams");
    if (!teams.length) return;
    const teamId = teams[0]._id;
    const [{ data: ov }, { data: al }] = await Promise.all([
      api.get(`/faculty/teams/${teamId}/overview`),
      api.get("/faculty/alerts"),
    ]);
    setOverview(ov);
    setAlerts(al);
  }

  useEffect(() => {
    load();
  }, []);

  if (!overview) {
    return (
      <div className="centered-page">
        No team data yet. Run <code>npm run seed</code> in the backend, or open this
        faculty account after teams have been created.
        <div>
          <button onClick={logout}>Log out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <h2>{overview.team.name} - Faculty View</h2>
        <button onClick={logout}>Log out</button>
      </header>

      <section className="card">
        <h3>Team Contribution Overview</h3>
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Contribution</th>
              <th>Risk</th>
              <th>Decision</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {overview.rows.map((r) => (
              <tr key={r.student.id}>
                <td>
                  {r.student.name} <span className="muted">({r.student.registerNo})</span>
                </td>
                <td>{r.contributionScore != null ? `${r.contributionScore}%` : "N/A"}</td>
                <td>
                  <RiskBadge level={r.riskLevel} />
                </td>
                <td>{r.decision || "-"}</td>
                <td>
                  <Link to={`/faculty/students/${r.student.id}`}>View detail</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ModelInsights />

      <section className="card">
        <h3>Active Alerts (NUDGE / ALERT)</h3>
        {alerts.length === 0 && <p className="muted">No active alerts.</p>}
        <ul className="alert-list">
          {alerts.map((a) => (
            <li key={a._id} className={a.decision === "ALERT" ? "alert-high" : "alert-medium"}>
              <strong>{a.student.name}</strong> - {a.decision}: {a.recommendation}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
