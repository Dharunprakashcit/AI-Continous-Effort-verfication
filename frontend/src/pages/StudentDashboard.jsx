import React, { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../AuthContext.jsx";
import RiskBadge from "../components/RiskBadge.jsx";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await api.get("/students/me/dashboard");
    setData(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function markComplete(taskId) {
    await api.patch(`/students/me/tasks/${taskId}`, { status: "Completed" });
    load();
  }

  async function logActivity() {
    setBusy(true);
    await api.post("/students/me/activity", {
      docEdits: 3,
      commits: 1,
      messagesSent: 2,
      repliesGiven: 1,
      activeMinutes: 45,
    });
    await api.post("/students/me/predict");
    await load();
    setBusy(false);
  }

  if (!data) return <div className="centered-page">Loading...</div>;

  const { tasks, activityLast7Days, latestPrediction } = data;

  return (
    <div className="page">
      <header className="topbar">
        <h2>Welcome, {user.name}</h2>
        <button onClick={logout}>Log out</button>
      </header>

      <section className="grid">
        <div className="card">
          <h3>Contribution Score</h3>
          <div className="big-number">
            {latestPrediction ? `${latestPrediction.contributionScore}%` : "N/A"}
          </div>
          {latestPrediction && <RiskBadge level={latestPrediction.riskLevel} />}
          <button disabled={busy} onClick={logActivity} style={{ marginTop: 12 }}>
            {busy ? "Working..." : "Log today's activity & re-evaluate"}
          </button>
        </div>

        <div className="card">
          <h3>Last 7 Days Activity</h3>
          <ul className="stat-list">
            <li>Tasks Completed: {tasks.filter((t) => t.status === "Completed").length}</li>
            <li>Tasks Assigned: {tasks.length}</li>
            <li>Document Edits: {activityLast7Days.docEdits}</li>
            <li>Commits: {activityLast7Days.commits}</li>
            <li>Messages Sent: {activityLast7Days.messagesSent}</li>
            <li>Replies Given: {activityLast7Days.repliesGiven}</li>
          </ul>
        </div>

        {latestPrediction && (
          <div className="card">
            <h3>AI Feedback</h3>
            <ul>
              {latestPrediction.explanations.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
            <p className="muted">{latestPrediction.recommendation}</p>
          </div>
        )}
      </section>

      <section className="card">
        <h3>My Tasks</h3>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Deadline</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t._id}>
                <td>{t.title}</td>
                <td>{new Date(t.deadline).toLocaleDateString()}</td>
                <td>{t.status}</td>
                <td>
                  {t.status !== "Completed" && (
                    <button onClick={() => markComplete(t._id)}>Mark complete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
