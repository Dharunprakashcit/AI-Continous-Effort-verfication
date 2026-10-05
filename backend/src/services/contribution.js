const Team = require("../models/Team");
const Task = require("../models/Task");
const Activity = require("../models/Activity");
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

function gitScore(commits, prs, files) {
  return (commits || 0) + 3 * (prs || 0) + 0.25 * (files || 0);
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

/**
 * Contribution shares for one team on one assignment.
 * Git and document signals come from stored records when they exist. A team
 * without records (for example one created after the work began) falls back to
 * each member's recorded commits and document edits since the assignment was set.
 * When nothing is recorded at all, no share is claimed and contribution is null.
 */
async function teamBreakdown(assignment, teamId) {
  const team = await Team.findById(teamId).populate("members", "name registerNo").lean();
  if (!team) return null;

  const memberIds = team.members.map((m) => m._id);
  const [tasks, records, activities] = await Promise.all([
    Task.find({ assignment: assignment._id, team: teamId }).sort({ createdAt: 1 }).lean(),
    Contribution.find({ assignment: assignment._id, team: teamId }).lean(),
    Activity.find({ student: { $in: memberIds }, date: { $gte: assignment.assignedDate || new Date(0) } }).lean(),
  ]);

  const members = team.members.map((m) => {
    const id = String(m._id);
    const mine = tasks.filter((t) => String(t.assignedTo) === id);
    const rec = records.find((r) => String(r.student) === id);
    const act = activities
      .filter((a) => String(a.student) === id)
      .reduce(
        (s, a) => ({
          docEdits: s.docEdits + a.docEdits,
          commits: s.commits + a.commits,
          messages: s.messages + a.messagesSent,
          replies: s.replies + a.repliesGiven,
        }),
        { docEdits: 0, commits: 0, messages: 0, replies: 0 }
      );

    const git = rec
      ? { commits: rec.commits, pullRequests: rec.pullRequests, filesModified: rec.filesModified }
      : { commits: act.commits, pullRequests: 0, filesModified: 0 };
    const docPages = rec ? rec.docPages : Math.round(act.docEdits / 3);

    return {
      student: m,
      mine,
      rec,
      act,
      git,
      docPages,
      raw: {
        tasks: mine.filter((t) => t.status === "Completed").length,
        git: gitScore(git.commits, git.pullRequests, git.filesModified),
        docs: docPages,
        peer: rec?.peerRating || 0,
        faculty: rec?.facultyRating || 0,
      },
    };
  });

  const totals = Object.fromEntries(Object.keys(WEIGHTS).map((c) => [c, members.reduce((a, m) => a + m.raw[c], 0)]));
  const active = Object.keys(WEIGHTS).filter((c) => totals[c] > 0);
  const weightSum = active.reduce((a, c) => a + WEIGHTS[c], 0);

  const exact = active.length
    ? members.map((m) => active.reduce((a, c) => a + (WEIGHTS[c] / weightSum) * (m.raw[c] / totals[c]) * 100, 0))
    : members.map(() => null);
  const rounded = active.length ? roundTo100(exact) : members.map(() => null);

  const rows = members.map((m, i) => ({
    student: { id: m.student._id, name: m.student.name, registerNo: m.student.registerNo },
    contribution: rounded[i],
    exact: exact[i] == null ? null : Math.round(exact[i] * 10) / 10,
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
    git: m.git,
    docs: { pages: m.docPages },
    peerRating: m.rec?.peerRating ?? null,
    facultyRating: m.rec?.facultyRating ?? null,
    activity: m.act,
    signalsFromActivity: !m.rec,
  }));

  return {
    team: { id: team._id, name: team.name, projectTitle: team.projectTitle },
    rows,
    weights: Object.keys(WEIGHTS).map((c) => ({ key: c, label: LABELS[c], weight: Math.round(WEIGHTS[c] * 100) })),
  };
}

const level = (ratio) => (ratio >= 1.15 ? "High" : ratio >= 0.6 ? "Medium" : "Low");

// The activity behind one member's estimate, in plain terms for students.
function memberSignals(row, rows) {
  const work = (r) => r.git.commits + 3 * r.git.pullRequests + 2 * r.docs.pages;
  const avgWork = rows.reduce((a, r) => a + work(r), 0) / (rows.length || 1);
  const fair = rows.length ? 100 / rows.length : 0;
  return {
    discussions: row.activity.replies,
    messages: row.activity.messages,
    tasksDone: row.tasksDone,
    submissionActivity: avgWork > 0 ? level(work(row) / avgWork) : "None recorded",
    teamParticipation: row.contribution == null ? "Not enough activity yet" : level(row.contribution / fair),
  };
}

module.exports = { teamBreakdown, memberSignals, WEIGHTS };
