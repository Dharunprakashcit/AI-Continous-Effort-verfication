import React from "react";
import { Link, useParams } from "react-router-dom";
import useApi from "../app/useApi";
import { Avatar, PageState, Panel, RiskPill, StatCard } from "../app/ui.jsx";
import { CountUp, HBars, Ring, StackedBars, colorForScore, RISK_COLOR } from "../app/charts.jsx";
import { IconBolt, IconTarget, IconTasks, IconTrophy } from "../app/icons.jsx";
import { ACTIVITY_SERIES } from "./StudentOverview.jsx";
import { fmtDate } from "./AssignmentsPage.jsx";

const FEATURE_LABELS = {
  attendance_pct: ["Attendance", "%"],
  internal_marks: ["Internal marks", ""],
  previous_gpa: ["Previous GPA", ""],
  submission_rate_pct: ["Individual assignments submitted", "%"],
  late_submissions: ["Late submissions", ""],
  avg_assignment_score: ["Average assignment score", ""],
  contribution_ratio: ["Team contribution (1.0 is an equal share)", ""],
  tasks_completed_pct: ["Tasks completed", "%"],
};

function AcademicRisk({ risk }) {
  const pct = Math.round(risk.probability * 100);
  const color = RISK_COLOR[risk.level];
  return (
    <Panel title="Academic risk prediction">
      <p className="muted" style={{ marginBottom: 16 }}>
        This is separate from contribution. Contribution says how much this student did on one assignment.
        Academic risk looks at overall behaviour, so a student can contribute little to one team project and
        still have low academic risk.
      </p>
      <div className="grid-2">
        <div className="inline-row" style={{ alignItems: "center", gap: 24 }}>
          <Ring value={pct} size={130} stroke={13} color={color} caption="risk" />
          <div>
            <RiskPill level={risk.level} />
            <p className="muted" style={{ marginTop: 8 }}>
              {risk.source === "model" ? `Trained model, version ${risk.modelVersion}.` : "Model service offline, using a rule-based estimate."}
            </p>
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>What stands out</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {risk.factors.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      </div>
      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th>Input to the model</th><th>Value</th></tr></thead>
          <tbody>
            {Object.entries(risk.features).map(([k, v]) => (
              <tr key={k}><td>{FEATURE_LABELS[k][0]}</td><td>{v}{FEATURE_LABELS[k][1]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function TeamAnalysis({ data }) {
  const c = data.contribution;
  return (
    <>
      <div className="stats">
        <StatCard tone="blue" icon={<IconTrophy />} label="Overall contribution"><CountUp value={c.contribution} suffix="%" /></StatCard>
        <StatCard tone="green" icon={<IconTasks />} label="Tasks done">{c.tasksDone} of {c.tasksTotal}</StatCard>
        <StatCard tone="yellow" icon={<IconBolt />} label="Team size"><CountUp value={data.teamSize} /></StatCard>
      </div>
      <p className="note">
        Estimated contribution score, not an absolute measure of effort. An equal share in this team would be{" "}
        {Math.round(100 / data.teamSize)}%.
      </p>

      <div className="grid-2">
        <Panel title="How this share was calculated">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Component</th><th>Weight</th><th>Share of team</th><th>Points</th></tr></thead>
              <tbody>
                {c.components.map((x) => (
                  <tr key={x.key}><td>{x.label}</td><td>{x.weight}%</td><td>{x.teamShare}%</td><td>{x.points}</td></tr>
                ))}
                <tr><td><strong>Total</strong></td><td>100%</td><td></td><td><strong>{c.exact}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Points by component">
          <HBars
            items={c.components.map((x) => ({ label: x.label, value: x.points, color: "#4b7bec" }))}
            max={40}
          />
        </Panel>
      </div>

      <div style={{ height: 24 }} />
      <div className="grid-2">
        <Panel title="Tasks" dark>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Task</th><th>Status</th></tr></thead>
              <tbody>
                {c.tasks.map((t, i) => (
                  <tr key={i}><td>{t.title}</td><td className={t.status === "Completed" ? "status-ok" : t.status === "Late" ? "status-bad" : ""}>{t.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Other signals" dark>
          <dl className="kv">
            <dt>Commits</dt><dd>{c.git.commits}</dd>
            <dt>Pull requests</dt><dd>{c.git.pullRequests}</dd>
            <dt>Files modified</dt><dd>{c.git.filesModified}</dd>
            <dt>Documentation pages</dt><dd>{c.docs.pages}</dd>
            <dt>Peer evaluation</dt><dd>{c.peerRating != null ? `${c.peerRating} / 5` : "Not collected"}</dd>
            <dt>Faculty evaluation</dt><dd>{c.facultyRating != null ? `${c.facultyRating} / 5` : "Not collected yet"}</dd>
          </dl>
        </Panel>
      </div>
    </>
  );
}

function IndividualAnalysis({ data }) {
  const s = data.submission;
  const a = data.assignment;
  return (
    <>
      <div className="grid-2">
        <Panel title="Submission" dark>
          <dl className="kv">
            <dt>Assigned</dt><dd>{fmtDate(a.assignedDate)}</dd>
            <dt>Due</dt><dd>{fmtDate(a.dueDate)}</dd>
            <dt>Submitted</dt><dd className={s.submitted ? "status-ok" : "status-bad"}>{s.submitted ? "Yes" : "No"}</dd>
            <dt>Submitted on</dt><dd>{s.submitted ? fmtDate(s.submittedAt) : "None"}</dd>
            <dt>Timing</dt><dd>{s.submitted ? (s.late ? "Late" : "On time") : "None"}</dd>
            <dt>Score</dt><dd>{s.score != null ? `${s.score} of ${a.maxScore}` : "None"}</dd>
            <dt>Attempts</dt><dd>{s.attempts}</dd>
            <dt>Feedback</dt><dd>{s.feedback || "None"}</dd>
          </dl>
        </Panel>
        <Panel title="Individual activity, last 7 days">
          <StackedBars data={data.activityByDay} series={ACTIVITY_SERIES} />
        </Panel>
      </div>
    </>
  );
}

export default function StudentAnalysis() {
  const { id, studentId } = useParams();
  const { data, error, loading } = useApi(`/assignments/${id}/students/${studentId}`);
  if (loading || error) return <PageState loading={loading} error={error} />;

  const { assignment: a, student, academicRisk } = data;
  const isTeam = data.kind === "team";
  const back = isTeam ? `/faculty/assignments/${id}/teams/${student.teamId}` : `/faculty/assignments/${id}`;

  return (
    <>
      <Link to={back} className="crumb">&larr; {isTeam ? student.teamName : a.title}</Link>
      <div className="profile">
        <div className="profile-main">
          <Avatar name={student.name} />
          <div>
            <h1>{student.name}</h1>
            <p className="meta">{student.registerNo}, {student.teamName}</p>
            <p className="meta">{a.title}</p>
          </div>
        </div>
        {isTeam ? (
          <Ring value={data.contribution.contribution} caption="of team contribution" color={colorForScore(Math.min(100, data.contribution.contribution * data.teamSize))} />
        ) : (
          <Ring value={data.submission.submitted ? 100 : 0} caption="contribution" color={data.submission.submitted ? RISK_COLOR.LOW : RISK_COLOR.HIGH} />
        )}
      </div>

      {isTeam ? <TeamAnalysis data={data} /> : <IndividualAnalysis data={data} />}

      <div style={{ height: 24 }} />
      <AcademicRisk risk={academicRisk} />
      <div className="btn-row">
        <Link className="btn ghost" to={`/faculty/students/${student.id}`}>View weekly effort monitoring</Link>
      </div>
    </>
  );
}
