import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import useApi from "../app/useApi";
import { Avatar, Empty, PageState, Panel, RiskPill } from "../app/ui.jsx";
import { LineChart, Ring, StackedBars } from "../app/charts.jsx";
import { IconTarget } from "../app/icons.jsx";
import { ACTIVITY_SERIES } from "./StudentOverview.jsx";
import { Breakdown, historySeries } from "./StudentFeedback.jsx";

export default function FacultyStudent() {
  const { studentId } = useParams();
  const { data, error, loading, reload } = useApi(`/faculty/students/${studentId}/detail`);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  if (loading || error) return <PageState loading={loading} error={error} />;

  const { student, latest, history, tasks, activityByDay } = data;

  async function rerun() {
    setBusy(true);
    setNote("");
    try {
      await api.post(`/faculty/students/${studentId}/predict`);
      await reload();
    } catch {
      setNote("Could not re-run the evaluation.");
    }
    setBusy(false);
  }

  async function sendFeedback(correct) {
    setBusy(true);
    setNote("");
    try {
      await api.post(`/faculty/predictions/${latest._id}/feedback`, { correct, comment });
      setComment("");
      await reload();
    } catch {
      setNote("Could not save feedback.");
    }
    setBusy(false);
  }

  return (
    <>
      <Link to={`/faculty/teams/${student.teamId}`} className="crumb">&larr; {student.teamName}</Link>
      <div className="profile">
        <div className="profile-main">
          <Avatar name={student.name} />
          <div>
            <h1>{student.name}</h1>
            <p className="meta">{student.registerNo}</p>
            <p className="meta">{student.teamName}</p>
          </div>
        </div>
        {latest && (
          <div style={{ textAlign: "center" }}>
            <Ring value={latest.contributionScore} caption="contribution score" />
            <div style={{ marginTop: 8 }}><RiskPill level={latest.riskLevel} /></div>
          </div>
        )}
      </div>

      {!latest ? (
        <Panel><Empty>No evaluation yet for this student.</Empty></Panel>
      ) : (
        <>
          <div className="grid-2">
            <Panel title="Agent breakdown">
              <Breakdown p={latest} />
              <p className="muted" style={{ marginTop: 16 }}>
                Decision: <strong>{latest.decision}</strong>. {latest.recommendation}
              </p>
            </Panel>
            <Panel title="Score over time">
              <LineChart series={historySeries(history)} />
            </Panel>
          </div>

          <h2 style={{ fontSize: "1.0625rem", margin: "24px 0 12px" }}>Why this score</h2>
          <ul className="rows" style={{ marginBottom: 24 }}>
            {latest.explanations.map((n, i) => (
              <li key={i} className="row-card" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="ico"><IconTarget /></span>
                <div className="title">{n}</div>
              </li>
            ))}
          </ul>

          <Panel title="Your review of this prediction">
            {latest.facultyFeedback?.reviewed ? (
              <p>
                Recorded as <strong>{latest.facultyFeedback.correct ? "correct" : "incorrect"}</strong>
                {latest.facultyFeedback.comment ? `: ${latest.facultyFeedback.comment}` : "."}
              </p>
            ) : (
              <>
                <label className="field-label" htmlFor="fb-comment">Comment (optional)</label>
                <textarea id="fb-comment" value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <button type="button" className="btn" disabled={busy} onClick={() => sendFeedback(true)}>
                    Prediction is correct
                  </button>
                  <button type="button" className="btn danger" disabled={busy} onClick={() => sendFeedback(false)}>
                    Prediction is incorrect
                  </button>
                </div>
              </>
            )}
            {note && <p className="msg err" role="alert">{note}</p>}
          </Panel>
        </>
      )}

      <div className="btn-row" style={{ marginBottom: 24 }}>
        <button type="button" className="btn ghost" disabled={busy} onClick={rerun}>Re-run evaluation</button>
      </div>

      <div className="grid-2">
        <Panel title="Activity, last 7 days">
          <StackedBars data={activityByDay} series={ACTIVITY_SERIES} />
        </Panel>
        <Panel title="Tasks" dark>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Task</th><th>Deadline</th><th>Status</th></tr></thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t._id}>
                    <td>{t.title}</td>
                    <td>{new Date(t.deadline).toLocaleDateString()}</td>
                    <td>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
