import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import RiskBadge from "../components/RiskBadge.jsx";

export default function StudentDetail() {
  const { studentId } = useParams();
  const [detail, setDetail] = useState(null);

  async function load() {
    const { data } = await api.get(`/faculty/students/${studentId}/detail`);
    setDetail(data);
  }

  useEffect(() => {
    load();
  }, [studentId]);

  async function reEvaluate() {
    await api.post(`/faculty/students/${studentId}/predict`);
    load();
  }

  async function sendFeedback(predictionId, correct) {
    const comment = window.prompt("Optional comment for this feedback:") || "";
    await api.post(`/faculty/predictions/${predictionId}/feedback`, { correct, comment });
    load();
  }

  if (!detail) return <div className="centered-page">Loading...</div>;
  const { latest, history } = detail;

  return (
    <div className="page">
      <header className="topbar">
        <Link to="/faculty">&larr; Back to team</Link>
        <button onClick={reEvaluate}>Re-run agent pipeline</button>
      </header>

      {!latest && <p>No predictions yet for this student.</p>}

      {latest && (
        <section className="grid">
          <div className="card">
            <h3>Overall</h3>
            <div className="big-number">{latest.contributionScore}%</div>
            <RiskBadge level={latest.riskLevel} />
            <p>
              Decision: <strong>{latest.decision}</strong>
            </p>
            <p className="muted">{latest.recommendation}</p>
          </div>

          <div className="card">
            <h3>Agent Breakdown</h3>
            <ul className="stat-list">
              <li>Edit Agent score: {latest.editScore}</li>
              <li>Task Agent score: {latest.taskScore}</li>
              <li>Communication Agent score: {latest.communicationScore}</li>
              <li>ANN risk probability: {(latest.annRiskProbability * 100).toFixed(1)}%</li>
            </ul>
          </div>

          <div className="card">
            <h3>Explanation</h3>
            <ul>
              {latest.explanations.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
            {!latest.facultyFeedback?.reviewed ? (
              <div className="feedback-buttons">
                <button onClick={() => sendFeedback(latest._id, true)}>
                  Correct prediction
                </button>
                <button onClick={() => sendFeedback(latest._id, false)}>
                  Incorrect prediction
                </button>
              </div>
            ) : (
              <p className="muted">
                Feedback recorded: {latest.facultyFeedback.correct ? "Correct" : "Incorrect"}
              </p>
            )}
          </div>
        </section>
      )}

      <section className="card">
        <h3>Prediction History</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Contribution</th>
              <th>Risk</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h._id}>
                <td>{new Date(h.createdAt).toLocaleString()}</td>
                <td>{h.contributionScore}%</td>
                <td>
                  <RiskBadge level={h.riskLevel} />
                </td>
                <td>{h.decision}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
