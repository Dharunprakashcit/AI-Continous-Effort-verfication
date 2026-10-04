import React from "react";
import { Link } from "react-router-dom";
import useApi from "../app/useApi";
import { Empty, PageState, Panel, StatCard } from "../app/ui.jsx";
import { CountUp, Ring, Sparkline, colorForScore } from "../app/charts.jsx";
import { IconBell, IconTarget, IconUsers } from "../app/icons.jsx";

export default function TeamsPage() {
  const { data: teams, error, loading } = useApi("/faculty/teams");
  if (loading || error) return <PageState loading={loading} error={error} />;

  const students = teams.reduce((a, t) => a + t.memberCount, 0);
  const high = teams.reduce((a, t) => a + t.riskCounts.HIGH, 0);
  const alerts = teams.reduce((a, t) => a + t.alerts, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your teams</h1>
          <p className="sub">Select a team to see each member's contribution.</p>
        </div>
      </div>

      <div className="stats">
        <StatCard tone="blue" icon={<IconUsers />} label="Teams"><CountUp value={teams.length} /></StatCard>
        <StatCard tone="green" icon={<IconTarget />} label="Students"><CountUp value={students} /></StatCard>
        <StatCard tone="yellow" icon={<IconBell />} label="Open alerts"><CountUp value={alerts} /></StatCard>
        <StatCard tone="pink" icon={<IconTarget />} label="High risk"><CountUp value={high} /></StatCard>
      </div>

      {teams.length === 0 ? (
        <Panel><Empty>No teams are assigned to you yet.</Empty></Panel>
      ) : (
        <div className="team-grid">
          {teams.map((t, i) => (
            <Link key={t._id} to={`/faculty/teams/${t._id}`} className="team-card" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="team-card-top">
                <div>
                  <h2>{t.name}</h2>
                  <p className="proj">{t.projectTitle}</p>
                </div>
                <Ring value={t.avgContribution} size={84} stroke={9} caption="average" />
              </div>
              <div className="chips">
                <span className="rpill low">{t.riskCounts.LOW} low</span>
                <span className="rpill medium">{t.riskCounts.MEDIUM} medium</span>
                <span className="rpill high">{t.riskCounts.HIGH} high</span>
              </div>
              <Sparkline points={t.trend} color={colorForScore(t.avgContribution)} width={240} height={40} />
              <div className="team-card-foot">
                <span>{t.memberCount} students</span>
                <span>View team</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
