import React from "react";
import { Link } from "react-router-dom";
import useApi from "../app/useApi";
import { Avatar, Empty, Panel, PageState, RiskPill, StatCard } from "../app/ui.jsx";
import { CountUp, Ring, StackedBars } from "../app/charts.jsx";
import { IconBolt, IconTarget, IconTasks, IconTrophy } from "../app/icons.jsx";

export const ACTIVITY_SERIES = [
  { key: "docEdits", label: "Document edits", color: "#4b7bec" },
  { key: "commits", label: "Commits", color: "#2e9e5b" },
  { key: "messages", label: "Messages", color: "#e0a100" },
  { key: "replies", label: "Replies", color: "#8854d0" },
];

export default function StudentOverview() {
  const { data, error, loading } = useApi("/students/me/dashboard");
  if (loading || error) return <PageState loading={loading} error={error} />;

  const { profile, rank, tasks, activityLast7Days: a, activityByDay, latestPrediction: p } = data;
  const done = tasks.filter((t) => t.status === "Completed").length;
  const points = a.docEdits + a.commits + a.messagesSent + a.repliesGiven;

  return (
    <>
      <div className="profile">
        <div className="profile-main">
          <Avatar name={profile.name} />
          <div>
            <h1>{profile.name}</h1>
            <p className="meta">{profile.registerNo}</p>
            <p className="meta">{profile.teamName}, {profile.projectTitle}</p>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <Ring value={p?.contributionScore ?? null} caption="contribution score" />
          {p && <div style={{ marginTop: 8 }}><RiskPill level={p.riskLevel} /></div>}
        </div>
      </div>

      <div className="stats">
        <StatCard tone="blue" icon={<IconTasks />} label="Tasks done">
          <CountUp value={done} />/{tasks.length}
        </StatCard>
        <StatCard tone="pink" icon={<IconTrophy />} label="Team rank">
          {rank.position ? <>#<CountUp value={rank.position} /> of {rank.of}</> : "N/A"}
        </StatCard>
        <StatCard tone="yellow" icon={<IconBolt />} label="Activity, 7 days">
          <CountUp value={points} />
        </StatCard>
      </div>

      {p ? (
        <ul className="rows" style={{ marginBottom: 24 }}>
          {p.explanations.map((note, i) => (
            <li key={i} className="row-card" style={{ animationDelay: `${i * 70}ms` }}>
              <span className="ico"><IconTarget /></span>
              <div>
                <div className="title">{note}</div>
              </div>
            </li>
          ))}
          <li className="row-card">
            <span className="ico" style={{ background: "#fdf1cb" }}><IconBolt /></span>
            <div>
              <div className="title">Suggested next step</div>
              <div className="sub">{p.recommendation}</div>
            </div>
            <Link className="btn small end" to="/student/activity">Log activity</Link>
          </li>
        </ul>
      ) : (
        <Panel><Empty>No evaluation yet. Log some activity to get your first score.</Empty></Panel>
      )}

      <div className="grid-2">
        <Panel title="Activity, last 7 days">
          <StackedBars data={activityByDay} series={ACTIVITY_SERIES} />
        </Panel>
        <Panel title="My tasks" dark>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Task</th><th>Deadline</th><th>Status</th></tr>
              </thead>
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
