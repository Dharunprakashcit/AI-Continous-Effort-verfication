const router = require("express").Router();
const Team = require("../models/Team");
const User = require("../models/User");
const Prediction = require("../models/Prediction");
const { requireAuth, requireRole } = require("../middleware/auth");
const { runPipelineForStudent } = require("../agents/orchestrator");

// Teams owned by the logged-in faculty member.
router.get("/teams", requireAuth, requireRole("faculty"), async (req, res) => {
  const teams = await Team.find({ faculty: req.user.id }).lean();
  res.json(teams);
});

// Team overview: every member's latest contribution score + risk level.
router.get("/teams/:teamId/overview", requireAuth, requireRole("faculty"), async (req, res) => {
  const team = await Team.findById(req.params.teamId).populate("members", "name registerNo");
  if (!team) return res.status(404).json({ error: "Team not found" });

  const rows = await Promise.all(
    team.members.map(async (member) => {
      const latest = await Prediction.findOne({ student: member._id })
        .sort({ createdAt: -1 })
        .lean();
      return {
        student: { id: member._id, name: member.name, registerNo: member.registerNo },
        contributionScore: latest?.contributionScore ?? null,
        riskLevel: latest?.riskLevel ?? "UNKNOWN",
        decision: latest?.decision ?? null,
        lastEvaluatedAt: latest?.createdAt ?? null,
      };
    })
  );

  res.json({ team: { id: team._id, name: team.name, projectTitle: team.projectTitle }, rows });
});

// Full agent explanation + history for a single student (drill-down).
router.get("/students/:studentId/detail", requireAuth, requireRole("faculty"), async (req, res) => {
  const history = await Prediction.find({ student: req.params.studentId })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  res.json({ history, latest: history[0] || null });
});

// Faculty triggers a fresh evaluation for a student.
router.post("/students/:studentId/predict", requireAuth, requireRole("faculty"), async (req, res) => {
  const student = await User.findById(req.params.studentId).lean();
  if (!student) return res.status(404).json({ error: "Student not found" });
  const prediction = await runPipelineForStudent(student._id, student.team);
  res.json(prediction);
});

// All HIGH-risk alerts across every team the faculty owns.
router.get("/alerts", requireAuth, requireRole("faculty"), async (req, res) => {
  const teams = await Team.find({ faculty: req.user.id }).lean();
  const teamIds = teams.map((t) => t._id);

  const alerts = await Prediction.find({ team: { $in: teamIds }, decision: { $ne: "ALLOW" } })
    .sort({ createdAt: -1 })
    .populate("student", "name registerNo")
    .populate("team", "name")
    .limit(50)
    .lean();

  res.json(alerts);
});

// Faculty confirms/rejects a prediction - feedback loop for future
// model/system improvement.
router.post("/predictions/:id/feedback", requireAuth, requireRole("faculty"), async (req, res) => {
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
router.get("/feedback-export", requireAuth, requireRole("faculty"), async (req, res) => {
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
