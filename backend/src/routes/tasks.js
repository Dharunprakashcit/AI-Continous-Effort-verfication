const router = require("express").Router();
const Task = require("../models/Task");
const { requireAuth, requireRole } = require("../middleware/auth");

// Faculty-only task CRUD (assigning work to a team).
router.post("/", requireAuth, requireRole("faculty"), async (req, res) => {
  const task = await Task.create(req.body);
  res.status(201).json(task);
});

router.get("/team/:teamId", requireAuth, async (req, res) => {
  const tasks = await Task.find({ team: req.params.teamId }).populate(
    "assignedTo",
    "name registerNo"
  );
  res.json(tasks);
});

router.put("/:id", requireAuth, requireRole("faculty"), async (req, res) => {
  const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task);
});

router.delete("/:id", requireAuth, requireRole("faculty"), async (req, res) => {
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json({ deleted: true });
});

module.exports = router;
