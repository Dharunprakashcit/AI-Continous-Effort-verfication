const router = require("express").Router();
const Task = require("../models/Task");
const Activity = require("../models/Activity");
const Prediction = require("../models/Prediction");
const { requireAuth, requireRole } = require("../middleware/auth");
const User = require("../models/User");
const { runPipelineForStudent } = require("../agents/orchestrator");
const { latestByStudent, activityByDay } = require("../services/stats");

// Student's own portal data: profile, rank in team, tasks, activity, latest prediction and history.
router.get("/me/dashboard", requireAuth, requireRole("student"), async (req, res) => {
  const studentId = req.user.id;

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const me = await User.findById(studentId).populate("team", "name projectTitle members").lean();

  const [tasks, activities, history, teamLatest] = await Promise.all([
    Task.find({ assignedTo: studentId }).sort({ deadline: 1 }).lean(),
    Activity.find({ student: studentId, date: { $gte: since } }).lean(),
    Prediction.find({ student: studentId }).sort({ createdAt: -1 }).limit(12).lean(),
    latestByStudent(me.team?.members || []),
  ]);
  const latestPrediction = history[0] || null;

  const ranked = [...teamLatest.entries()].sort(
    (a, b) => b[1].contributionScore - a[1].contributionScore
  );
  const position = ranked.findIndex(([id]) => id === String(studentId)) + 1;

  const totals = activities.reduce(
    (acc, a) => {
      acc.docEdits += a.docEdits;
      acc.commits += a.commits;
      acc.messagesSent += a.messagesSent;
      acc.repliesGiven += a.repliesGiven;
      return acc;
    },
    { docEdits: 0, commits: 0, messagesSent: 0, repliesGiven: 0 }
  );

  res.json({
    profile: {
      name: me.name,
      registerNo: me.registerNo,
      teamName: me.team?.name,
      projectTitle: me.team?.projectTitle,
    },
    rank: { position: position || null, of: ranked.length },
    tasks,
    activityLast7Days: totals,
    activityByDay: await activityByDay({ student: studentId }),
    latestPrediction,
    history,
  });
});

// Student submits/updates a task's status (also used for CRUD demo).
router.patch("/me/tasks/:taskId", requireAuth, requireRole("student"), async (req, res) => {
  const { status } = req.body;
  if (!["Not Started", "In Progress", "Completed"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const task = await Task.findOne({ _id: req.params.taskId, assignedTo: req.user.id });
  if (!task) return res.status(404).json({ error: "Task not found" });

  task.status = status;
  if (status === "Completed") task.completedAt = new Date();
  await task.save();
  res.json(task);
});

// Student logs a day of activity (edits/commits/messages) - normally
// this would be captured automatically by IDE/git/chat integrations,
// but is exposed here so the demo can be driven manually.
router.post("/me/activity", requireAuth, requireRole("student"), async (req, res) => {
  const count = (v) => Math.min(500, Math.max(0, Math.floor(Number(v) || 0)));
  const docEdits = count(req.body.docEdits);
  const commits = count(req.body.commits);
  const messagesSent = count(req.body.messagesSent);
  const repliesGiven = count(req.body.repliesGiven);
  const activeMinutes = count(req.body.activeMinutes);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activity = await Activity.findOneAndUpdate(
    { student: req.user.id, date: today },
    {
      $inc: { docEdits, commits, messagesSent, repliesGiven, activeMinutes },
      $setOnInsert: { team: req.user.team },
    },
    { upsert: true, new: true }
  );

  res.json(activity);
});

// Re-run the agent pipeline on demand for the logged-in student.
router.post("/me/predict", requireAuth, requireRole("student"), async (req, res) => {
  const prediction = await runPipelineForStudent(req.user.id, req.user.team);
  res.json(prediction);
});

module.exports = router;
