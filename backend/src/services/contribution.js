const Team = require("../models/Team");
const Task = require("../models/Task");
const Contribution = require("../models/Contribution");

// Weights from the project brief. Each component is a student's share of the team's total.
const WEIGHTS = { tasks: 0.4, git: 0.3, docs: 0.1, peer: 0.1, faculty: 0.1 };
const LABELS = {
  tasks: "Task completion",
  git: "Git activity",
  docs: "Documentation",
  peer: "Peer evaluation",
  faculty: "Faculty evaluation",
};

function gitScore(r) {
  return (r?.commits || 0) + 3 * (r?.pullRequests || 0) + 0.25 * (r?.filesModified || 0);
}

// Rounds shares to whole percents that add up to exactly 100.
function roundTo100(values) {
  const floors = values.map((v) => Math.floor(v));
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = values.map((v, i) => [v - floors[i], i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

function taskStatus(tasks) {
  if (!tasks.length) return "No tasks";
  const done = tasks.filter((t) => t.status === "Completed").length;
  if (done === tasks.length) return "Completed";
  if (done > 0) return "Partial";
  if (tasks.some((t) => t.status === "In Progress")) return "In progress";
  if (tasks.every((t) => t.status === "Not Started")) return "Not started";
  return "Not completed";
}

async function teamBreakdown(assignment, teamId) {
  const team = await Team.findById(teamId).populate("members", "name registerNo").lean();
  if (!team) return null;

  const [tasks, records] = await Promise.all([
    Task.find({ assignment: assignment._id, team: teamId }).sort({ createdAt: 1 }).lean(),
    Contribution.find({ assignment: assignment._id, team: teamId }).lean(),
  ]);

  const members = team.members.map((m) => {
    const id = String(m._id);
    const mine = tasks.filter((t) => String(t.assignedTo) === id);
    const rec = records.find((r) => String(r.student) === id);
    const raw = {
      tasks: mine.filter((t) => t.status === "Completed").length,
      git: gitScore(rec),
      docs: rec?.docPages || 0,
      peer: rec?.peerRating || 0,
      faculty: rec?.facultyRating || 0,
    };
    return { student: m, mine, rec, raw };
  });

  const totals = Object.fromEntries(Object.keys(WEIGHTS).map((c) => [c, members.reduce((a, m) => a + m.raw[c], 0)]));
  const active = Object.keys(WEIGHTS).filter((c) => totals[c] > 0);
  const weightSum = active.reduce((a, c) => a + WEIGHTS[c], 0) || 1;

  const exact = members.map((m) =>
    active.reduce((a, c) => a + (WEIGHTS[c] / weightSum) * (m.raw[c] / totals[c]) * 100, 0)
  );
  const rounded = members.length ? roundTo100(exact) : [];

  const rows = members.map((m, i) => ({
    student: { id: m.student._id, name: m.student.name, registerNo: m.student.registerNo },
    contribution: rounded[i],
    exact: Math.round(exact[i] * 10) / 10,
    components: Object.keys(WEIGHTS).map((c) => {
      const teamShare = totals[c] > 0 ? (m.raw[c] / totals[c]) * 100 : 0;
      return {
        key: c,
        label: LABELS[c],
        weight: Math.round(WEIGHTS[c] * 100),
        teamShare: Math.round(teamShare),
        points: active.includes(c) ? Math.round((WEIGHTS[c] / weightSum) * teamShare * 10) / 10 : 0,
      };
    }),
    tasks: m.mine.map((t) => ({ title: t.title, status: t.status })),
    tasksDone: m.raw.tasks,
    tasksTotal: m.mine.length,
    status: taskStatus(m.mine),
    git: { commits: m.rec?.commits || 0, pullRequests: m.rec?.pullRequests || 0, filesModified: m.rec?.filesModified || 0 },
    docs: { pages: m.rec?.docPages || 0 },
    peerRating: m.rec?.peerRating ?? null,
    facultyRating: m.rec?.facultyRating ?? null,
  }));

  return {
    team: { id: team._id, name: team.name, projectTitle: team.projectTitle },
    rows,
    weights: Object.keys(WEIGHTS).map((c) => ({ key: c, label: LABELS[c], weight: Math.round(WEIGHTS[c] * 100) })),
  };
}

module.exports = { teamBreakdown, WEIGHTS };
