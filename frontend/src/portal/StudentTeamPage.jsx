import React from "react";
import { Link, useParams } from "react-router-dom";
import useApi from "../app/useApi";
import { PageState, Panel } from "../app/ui.jsx";

export default function StudentTeamPage() {
  const { id, teamId } = useParams();
  const { data, error, loading } = useApi(`/my/assignments/${id}/teams/${teamId}`);
  if (loading || error) return <PageState loading={loading} error={error} />;

  const { assignment, team, rows } = data;

  return (
    <>
      <Link to={`/student/assignments/${id}`} className="crumb">&larr; {assignment.title}</Link>
      <div className="page-head">
        <div>
          <h1>{team.name}</h1>
          <p className="sub">{assignment.title}</p>
        </div>
      </div>

      <p className="note">
        Contribution is an estimate calculated by the system from recorded activity. It is not entered by
        students and is not a grade.
      </p>

      <Panel title="Team members" dark>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Contribution</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student.id} className="row-link">
                  <td>{r.student.name}{r.isMe && <span className="muted"> (you)</span>}</td>
                  <td><strong>{r.contribution != null ? `${r.contribution}%` : "Not enough activity yet"}</strong></td>
                  <td>
                    <Link className="row-open" to={`/student/assignments/${id}/teams/${teamId}/members/${r.student.id}`}>
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
