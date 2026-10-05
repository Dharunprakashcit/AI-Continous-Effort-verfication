const router = require("express").Router();
const Team = require("../models/Team");
const User = require("../models/User");
const Task = require("../models/Task");
const Prediction = require("../models/Prediction");
const { requireAuth, requireRole } = require("../middleware/auth");
const { runPipelineForStudent } = require("../agents/orchestrator");
const { latestByStudent, weeklyTrend, activityByDay, riskCounts, average } = require("../services/stats");

const facultyOnly = [requireAuth, requireRole("faculty")];

async function ownedTeam(req, teamId) {
  return Team.findOne({ _id: teamId, faculty: req.user.id }).populate("members", "name registerNo");
}

async function ownedStudent(req, studentId) {
  const student = await User.findById(studentId).lean();
  if (!student || !student.team) return null;
  const team = await Team.findOne({ _id: student.team, faculty: req.user.id }).lean();
  return team ? { student, team } : null;
}

// Every team the faculty member owns, with the numbers shown on a team card.
router.get("/teams", ...facultyOnly, async (req, res) => {
  const teams = await Team.find({ faculty: req.user.id, assignment: null }).lean();
  const out = await Promise.all(
    teams.map(async (t) => {
      const latest = [...(await latestByStudent(t.members)).values()];
      return {
        _id: t._id,
        name: t.name,
        projectTitle: t.projectTitle,
        memberCount: t.members.length,
        avgContribution: average(latest.map((p) => p.contributionScore)),
        riskCounts: riskCounts(latest),
        alerts: latest.filter((p) => p.decision === "ALERT").length,
        trend: await weeklyTrend(t.members),
      };
    })
  );
  res.json(out);
});

// One team: member scores, weekly trend and this week's activity.
router.get("/teams/:teamId/overview", ...facultyOnly, async (req, res) => {
  const team = await ownedTeam(req, req.params.teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const memberIds = team.members.map((m) => m._id);
  const latest = await latestByStudent(memberIds);

  const rows = team.members.map((member) => {
    const p = latest.get(String(member._id));
    return {
      student: { id: member._id, name: member.name, registerNo: member.registerNo },
      contributionScore: p?.contributionScore ?? null,
      riskLevel: p?.riskLevel ?? "UNKNOWN",
      decision: p?.decision ?? null,
      lastEvaluatedAt: p?.createdAt ?? null,
    };
  });

  res.json({
    team: { id: team._id, name: team.name, projectTitle: team.projectTitle },
    rows,
    avgContribution: average(rows.filter((r) => r.contributionScore != null).map((r) => r.contributionScore)),
    trend: await weeklyTrend(memberIds),
    activityByDay: await activityByDay({ team: team._id }),
  });
});

// Cross-team analytics.
router.get("/analytics", ...facultyOnly, async (req, res) => {
  const teams = await Team.find({ faculty: req.user.id, assignment: null }).lean();
  const allIds = teams.flatMap((t) => t.members);
  const latest = await latestByStudent(allIds);
  const latestAll = [...latest.values()];

  const teamComparison = teams.map((t) => ({
    id: t._id,
    name: t.name,
    avg: average(t.members.map((m) => latest.get(String(m))?.contributionScore).filter((v) => v != null)),
  }));

  const series = await Promise.all(
    teams.map(async (t) => ({ name: t.name, points: await weeklyTrend(t.members) }))
  );

  res.json({
    totals: {
      teams: teams.length,
      students: allIds.length,
      atRisk: latestAll.filter((p) => p.riskLevel === "HIGH").length,
      avgContribution: average(latestAll.map((p) => p.contributionScore)),
    },
    riskDistribution: riskCounts(latestAll),
    teamComparison,
    trends: series,
  });
});

// Full agent explanation, history and activity for one student.
router.get("/students/:studentId/detail", ...facultyOnly, async (req, res) => {
  const owned = await ownedStudent(req, req.params.studentId);
  if (!owned) return res.status(404).json({ error: "Student not found" });

  const history = await Prediction.find({ student: owned.student._id })
    .sort({ createdAt: -1 })
    .limit(12)
    .lean();
  const tasks = await Task.find({ assignedTo: owned.student._id }).sort({ deadline: 1 }).lean();

  res.json({
    student: {
      id: owned.student._id,
      name: owned.student.name,
      registerNo: owned.student.registerNo,
      teamId: owned.team._id,
      teamName: owned.team.name,
    },
    latest: history[0] || null,
    history,
    tasks,
    activityByDay: await activityByDay({ student: owned.student._id }),
  });
});

router.post("/students/:studentId/predict", ...facultyOnly, async (req, res) => {
  const owned = await ownedStudent(req, req.params.studentId);
  if (!owned) return res.status(404).json({ error: "Student not found" });
  const prediction = await runPipelineForStudent(owned.student._id, owned.student.team);
  res.json(prediction);
});

// Students who currently need a nudge or an alert (latest prediction only), highest risk first.
router.get("/alerts", ...facultyOnly, async (req, res) => {
  const teams = await Team.find({ faculty: req.user.id, assignment: null }).lean();
  const teamName = new Map(teams.map((t) => [String(t._id), t.name]));
  const latest = await latestByStudent(teams.flatMap((t) => t.members));

  const flagged = [...latest.values()].filter((p) => p.decision !== "ALLOW");
  const students = await User.find({ _id: { $in: flagged.map((p) => p.student) } })
    .select("name registerNo")
    .lean();
  const byId = new Map(students.map((s) => [String(s._id), s]));

  const out = flagged
    .sort((a, b) => b.overallRisk - a.overallRisk)
    .map((p) => ({
      _id: p._id,
      student: byId.get(String(p.student)),
      team: { id: p.team, name: teamName.get(String(p.team)) },
      decision: p.decision,
      riskLevel: p.riskLevel,
      contributionScore: p.contributionScore,
      recommendation: p.recommendation,
      reason: p.explanations?.[0] || "",
      createdAt: p.createdAt,
    }));
  res.json(out);
});

// Faculty confirms or rejects a prediction. This feeds retrain.py.
router.post("/predictions/:id/feedback", ...facultyOnly, async (req, res) => {
  const { correct, comment } = req.body;
  const prediction = await Prediction.findByIdAndUpdate(
    req.params.id,
    {
      facultyFeedback: {
        reviewed: true,
        correct,
        comment,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      },
    },
    { new: true }
  );
  if (!prediction) return res.status(404).json({ error: "Prediction not found" });
  res.json(prediction);
});

// Faculty-reviewed predictions as labelled training rows for retrain.py.
// A confirmed prediction keeps its label; a rejected one flips it.
router.get("/feedback-export", ...facultyOnly, async (req, res) => {
  const reviewed = await Prediction.find({
    "facultyFeedback.reviewed": true,
    featuresUsed: { $exists: true },
  }).lean();

  const rows = reviewed.map((p) => {
    const predictedAtRisk = p.riskLevel !== "LOW" ? 1 : 0;
    return {
      ...p.featuresUsed,
      risk_label: p.facultyFeedback.correct ? predictedAtRisk : 1 - predictedAtRisk,
    };
  });
  res.json(rows);
});

module.exports = router;
