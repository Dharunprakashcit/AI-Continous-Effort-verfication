import React, { useState } from "react";
import api from "../api";
import useApi from "../app/useApi";
import { Empty, PageState, Panel } from "../app/ui.jsx";

const EDITABLE = ["Not Started", "In Progress", "Completed"];

export default function StudentTasks() {
  const { data, error, loading, reload } = useApi("/students/me/dashboard");
  const [message, setMessage] = useState("");

  if (loading || error) return <PageState loading={loading} error={error} />;

  async function setStatus(task, status) {
    setMessage("");
    try {
      await api.patch(`/students/me/tasks/${task._id}`, { status });
      await api.post("/students/me/predict");
      setMessage(`"${task.title}" is now ${status}. Your score was re-evaluated.`);
      reload();
    } catch {
      setMessage("Could not update the task. Try again.");
    }
  }

  const done = data.tasks.filter((t) => t.status === "Completed").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tasks</h1>
          <p className="sub">{done} of {data.tasks.length} completed</p>
        </div>
      </div>

      <Panel title="Assigned to me" dark>
        {data.tasks.length === 0 ? (
          <Empty>No tasks have been assigned yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Task</th><th>Deadline</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.tasks.map((t) => (
                  <tr key={t._id}>
                    <td>{t.title}</td>
                    <td>{new Date(t.deadline).toLocaleDateString()}</td>
                    <td>
                      <label className="sr-only" htmlFor={`st-${t._id}`} style={{ position: "absolute", left: -9999 }}>
                        Status of {t.title}
                      </label>
                      <select id={`st-${t._id}`} value={t.status} onChange={(e) => setStatus(t, e.target.value)}>
                        {t.status === "Late" && <option value="Late" disabled>Late</option>}
                        {EDITABLE.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {message && <p className="msg ok" role="status">{message}</p>}
      </Panel>
    </>
  );
}
