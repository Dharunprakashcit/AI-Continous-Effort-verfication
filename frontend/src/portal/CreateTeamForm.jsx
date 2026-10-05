import React, { useEffect, useState } from "react";
import api from "../api";
import { Skeleton } from "../app/ui.jsx";

// Used by students (base "my/assignments") and faculty (base "assignments").
// It collects a name and members only. Contribution is never entered here.
export default function CreateTeamForm({ assignmentId, base, onCreated, onCancel }) {
  const [students, setStudents] = useState(null);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get(`/${base}/${assignmentId}/available-students`)
      .then(({ data }) => {
        setStudents(data);
        setPicked(Object.fromEntries(data.filter((s) => s.isMe).map((s) => [s.id, true])));
      })
      .catch(() => setError("Could not load the students you can add."));
  }, [assignmentId, base]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    const memberIds = Object.keys(picked).filter((id) => picked[id]);
    if (!name.trim()) return setError("Enter a team name.");
    if (memberIds.length < 2) return setError("Choose at least two members.");
    setBusy(true);
    try {
      await api.post(`/${base}/${assignmentId}/teams`, { name, memberIds });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || "Could not create the team.");
      setBusy(false);
    }
  }

  if (!students && !error) return <Skeleton lines={3} />;

  return (
    <form onSubmit={submit} noValidate>
      <p className="note">
        A team only organises the project. You do not enter contribution percentages. The system estimates
        each member's contribution from their recorded activity.
      </p>

      <label className="field-label" htmlFor="team-name">Team name</label>
      <input
        id="team-name"
        type="text"
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: "100%", maxWidth: 360, font: "inherit", padding: "10px 12px", border: "1px solid #c9d1de", borderRadius: 6 }}
      />

      <fieldset style={{ border: 0, padding: 0, margin: "20px 0 0" }}>
        <legend className="field-label">Members</legend>
        {students?.length === 0 && <p className="empty">Every student is already on a team for this assignment.</p>}
        <ul className="rows" style={{ gap: 6 }}>
          {students?.map((s) => (
            <li key={s.id}>
              <label className="inline-row" style={{ gap: 10, cursor: s.isMe ? "default" : "pointer" }}>
                <input
                  type="checkbox"
                  checked={!!picked[s.id]}
                  disabled={s.isMe}
                  onChange={(e) => setPicked({ ...picked, [s.id]: e.target.checked })}
                />
                {s.name}
                {s.isMe && <span className="muted">(you)</span>}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {error && <p className="msg err" role="alert">{error}</p>}
      <div className="btn-row" style={{ marginTop: 16 }}>
        <button type="submit" className="btn" disabled={busy}>{busy ? "Creating" : "Create Team"}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
