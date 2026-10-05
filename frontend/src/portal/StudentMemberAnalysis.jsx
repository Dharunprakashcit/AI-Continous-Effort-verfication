import React from "react";
import { Link, useParams } from "react-router-dom";
import useApi from "../app/useApi";
import { Avatar, PageState, Panel } from "../app/ui.jsx";
import { Ring } from "../app/charts.jsx";

export default function StudentMemberAnalysis() {
  const { id, studentId } = useParams();
  const { data, error, loading } = useApi(`/my/assignments/${id}/members/${studentId}`);
  if (loading || error) return <PageState loading={loading} error={error} />;

  const { assignment, team, student, estimate, signals } = data;

  return (
    <>
      <Link to={`/student/assignments/${id}`} className="crumb">&larr; {assignment.title}</Link>
      <div className="profile">
        <div className="profile-main">
          <Avatar name={student.name} />
          <div>
            <h1>{student.name}{student.isMe ? " (you)" : ""}</h1>
            <p className="meta">Contribution Analysis</p>
            <p className="meta">{team.name}, {assignment.title}</p>
          </div>
        </div>
        <Ring value={estimate} caption="estimated contribution" color="#4b7bec" />
      </div>

      <Panel title="Contribution analysis" dark>
        <dl className="kv">
          <dt>Comments / Discussions</dt><dd>{signals.commentsDiscussions}</dd>
          <dt>Relevant interactions</dt><dd>{signals.relevantInteractions}</dd>
          <dt>Tasks completed</dt><dd>{signals.tasksCompleted}</dd>
          <dt>Submissions</dt><dd>{signals.submissions}</dd>
          <dt>Project activity</dt><dd>{signals.projectActivity}</dd>
          <dt><strong>Estimated Contribution</strong></dt>
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
