import React, { useState } from "react";
import api from "../api";
import useApi from "../app/useApi";
import { PageState, Panel } from "../app/ui.jsx";
import { StackedBars } from "../app/charts.jsx";
import { ACTIVITY_SERIES } from "./StudentOverview.jsx";

const FIELDS = [
  ["docEdits", "Document edits"],
  ["commits", "Commits"],
  ["messagesSent", "Messages sent"],
  ["repliesGiven", "Replies given"],
  ["activeMinutes", "Active minutes"],
];

export default function StudentActivity() {
  const { data, error, loading, reload } = useApi("/students/me/dashboard");
  const [form, setForm] = useState({ docEdits: "", commits: "", messagesSent: "", repliesGiven: "", activeMinutes: "" });
  const [status, setStatus] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);

  if (loading || error) return <PageState loading={loading} error={error} />;

  async function submit(e) {
    e.preventDefault();
    const body = Object.fromEntries(FIELDS.map(([k]) => [k, Number(form[k]) || 0]));
    if (Object.values(body).every((v) => v === 0)) {
      setStatus({ kind: "err", text: "Enter at least one number above zero." });
      return;
    }
    setBusy(true);
    setStatus({ kind: "", text: "" });
    try {
      await api.post("/students/me/activity", body);
      await api.post("/students/me/predict");
      setForm({ docEdits: "", commits: "", messagesSent: "", repliesGiven: "", activeMinutes: "" });
      setStatus({ kind: "ok", text: "Activity saved and your score was re-evaluated." });
      reload();
    } catch {
      setStatus({ kind: "err", text: "Could not save activity. Try again." });
    }
    setBusy(false);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p className="sub">Log today's work. Saving re-runs your evaluation.</p>
        </div>
      </div>

      <div className="grid-2">
        <Panel title="Last 7 days">
          <StackedBars data={data.activityByDay} series={ACTIVITY_SERIES} />
        </Panel>
        <Panel title="Log today's activity">
          <form onSubmit={submit} noValidate>
            <div className="form-grid">
              {FIELDS.map(([key, label]) => (
                <div key={key}>
                  <label htmlFor={key}>{label}</label>
                  <input
                    id={key}
                    type="number"
                    min="0"
                    max="500"
                    inputMode="numeric"
                    placeholder="0"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Saving" : "Save and re-evaluate"}
            </button>
            {status.text && <p className={`msg ${status.kind}`} role="status">{status.text}</p>}
          </form>
        </Panel>
      </div>

      <Panel title="Daily breakdown" dark>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Day</th><th>Document edits</th><th>Commits</th><th>Messages</th><th>Replies</th></tr>
            </thead>
            <tbody>
              {data.activityByDay.map((d, i) => (
                <tr key={i}>
                  <td>{d.label}</td><td>{d.docEdits}</td><td>{d.commits}</td><td>{d.messages}</td><td>{d.replies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
