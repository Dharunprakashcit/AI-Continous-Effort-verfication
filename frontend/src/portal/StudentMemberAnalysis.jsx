import React from "react";
import { Link, useParams } from "react-router-dom";
import useApi from "../app/useApi";
import { Avatar, PageState, Panel } from "../app/ui.jsx";
import { Ring } from "../app/charts.jsx";

export default function StudentMemberAnalysis() {
  const { id, teamId, studentId } = useParams();
  const { data, error, loading } = useApi(`/my/assignments/${id}/teams/${teamId}/members/${studentId}`);
  if (loading || error) return <PageState loading={loading} error={error} />;

  const { assignment, team, student, estimate, signals } = data;

  return (
    <>
      <Link to={`/student/assignments/${id}/teams/${teamId}`} className="crumb">&larr; {team.name}</Link>
      <div className="profile">
        <div className="profile-main">
          <Avatar name={student.name} />
          <div>
            <h1>{student.name}{student.isMe ? " (you)" : ""}</h1>
            <p className="meta">{team.name}, {assignment.title}</p>
          </div>
        </div>
        <Ring value={estimate} caption="estimated contribution" color="#4b7bec" />
      </div>

      <Panel title="Contribution analysis" dark>
        <dl className="kv">
          <dt>Relevant discussions</dt><dd>{signals.discussions}</dd>
          <dt>Comments and messages</dt><dd>{signals.messages}</dd>
          <dt>Tasks completed</dt><dd>{signals.tasksDone}</dd>
          <dt>Submission activity</dt><dd>{signals.submissionActivity}</dd>
          <dt>Team participation</dt><dd>{signals.teamParticipation}</dd>
          <dt><strong>Estimated contribution</strong></dt>
          <dd><strong>{estimate != null ? `${estimate}%` : "Not enough activity yet"}</strong></dd>
        </dl>
        <p className="muted" style={{ marginTop: 16 }}>
          The system calculates this estimate from the activity above. It is not entered by anyone, and it is
          not an absolute measure of effort.
        </p>
      </Panel>
    </>
  );
}
