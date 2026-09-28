const router = require("express").Router();
const Task = require("../models/Task");
const Activity = require("../models/Activity");
const Prediction = require("../models/Prediction");
const { requireAuth, requireRole } = require("../middleware/auth");
const { runPipelineForStudent } = require("../agents/orchestrator");

// Student's own dashboard: tasks, recent activity totals, latest prediction.
router.get("/me/dashboard", requireAuth, requireRole("student"), async (req, res) => {
  const studentId = req.user.id;

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [tasks, activities, latestPrediction] = await Promise.all([
    Task.find({ assignedTo: studentId }).sort({ deadline: 1 }).lean(),
    Activity.find({ student: studentId, date: { $gte: since } }).lean(),
    Prediction.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
  ]);

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
    tasks,
    activityLast7Days: totals,
    latestPrediction,
  });
});

// Student submits/updates a task's status (also used for CRUD demo).
router.patch("/me/tasks/:taskId", requireAuth, requireRole("student"), async (req, res) => {
  const { status } = req.body;
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
  const { docEdits = 0, commits = 0, messagesSent = 0, repliesGiven = 0, activeMinutes = 0 } =
    req.body;

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
