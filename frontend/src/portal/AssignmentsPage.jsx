import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import useApi from "../app/useApi";
import { Empty, PageState, Panel } from "../app/ui.jsx";
import { IconBook } from "../app/icons.jsx";

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "None";

export function TypePill({ type }) {
  return <span className={`tpill ${type}`}>{type === "team" ? "Team" : "Individual"}</span>;
}

function ClassroomPanel({ status, onChanged }) {
  const [courseId, setCourseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: "", text: "" });

  async function connect() {
    setBusy(true);
    setMsg({ kind: "", text: "" });
    try {
      await api.post("/classroom/connect");
      await onChanged();
    } catch {
      setMsg({ kind: "err", text: "Could not connect. Try again." });
    }
    setBusy(false);
  }

  async function sync() {
    setBusy(true);
    setMsg({ kind: "", text: "" });
    try {
      const { data } = await api.post("/classroom/sync", { courseId });
      setMsg({
        kind: "ok",
        text: data.imported.length
          ? `Imported ${data.imported.length} assignments and ${data.submissions} submissions from ${data.course.name}.`
          : `${data.course.name} has no coursework to import.`,
      });
      await onChanged();
    } catch (err) {
      setMsg({ kind: "err", text: err.response?.data?.error || "Sync failed. Try again." });
    }
    setBusy(false);
  }

  return (
    <Panel title="Google Classroom">
      <p className="note">
        This is a simulated Classroom. No Google account is connected, and the courses, assignments and
        scores below are generated for the demo.
      </p>
      {!status.connected ? (
        <div className="inline-row">
          <button type="button" className="btn" disabled={busy} onClick={connect}>
            {busy ? "Connecting" : "Connect Google Classroom"}
          </button>
          <span className="muted">Then choose a course and sync its assignments.</span>
        </div>
      ) : (
        <div className="inline-row">
          <div style={{ minWidth: 260, flex: "0 1 340px" }}>
            <label className="field-label" htmlFor="course">Course</label>
            <select id="course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Select a course</option>
              {status.courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button type="button" className="btn" disabled={busy || !courseId} onClick={sync} style={{ alignSelf: "flex-end" }}>
            {busy ? "Syncing" : "Sync assignments"}
          </button>
        </div>
      )}
      {msg.text && <p className={`msg ${msg.kind}`} role="status">{msg.text}</p>}
    </Panel>
  );
}

function summary(a) {
  const t = a.totals;
  if (a.type === "individual") {
    return `${t.submitted} of ${t.students} submitted${t.avgScore != null ? `, average ${t.avgScore}` : ""}`;
  }
  return t.submitted
    ? `${t.submitted} of ${t.teams} teams submitted${t.avgScore != null ? `, average ${t.avgScore}` : ""}`
    : `${t.teams} teams, not submitted yet`;
}

export default function AssignmentsPage() {
  const status = useApi("/classroom/status");
  const list = useApi("/assignments");

  if (status.loading || status.error) return <PageState loading={status.loading} error={status.error} />;

  async function refresh() {
    await Promise.all([status.reload(), list.reload()]);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assignments</h1>
          <p className="sub">Pick an assignment to see submissions or team contributions.</p>
        </div>
      </div>

      <ClassroomPanel status={status.data} onChanged={refresh} />

      {list.loading ? (
        <PageState loading />
      ) : list.data?.length ? (
        <ul className="rows">
          {list.data.map((a, i) => (
            <li key={a.id}>
              <Link to={`/faculty/assignments/${a.id}`} className="row-card" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="ico"><IconBook /></span>
                <div className="grow">
                  <div className="title">{a.title}</div>
                  <div className="sub">{a.course}, due {fmtDate(a.dueDate)}</div>
                  <div className="sub">{summary(a)}</div>
                </div>
                <div className="end"><TypePill type={a.type} /></div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Panel><Empty>No assignments yet. Connect Google Classroom, choose a course and sync.</Empty></Panel>
      )}
    </>
  );
}
