const router = require("express").Router();
const User = require("../models/User");
const Assignment = require("../models/Assignment");
const { requireAuth, requireRole } = require("../middleware/auth");
const { listCourses, syncCourse } = require("../services/classroom");

const facultyOnly = [requireAuth, requireRole("faculty")];
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

router.get(
  "/status",
  ...facultyOnly,
  wrap(async (req, res) => {
    const me = await User.findById(req.user.id).lean();
    const synced = await Assignment.countDocuments({ faculty: req.user.id, syncedAt: { $ne: null } });
    res.json({
      simulated: true,
      connected: !!me.classroomConnectedAt,
      connectedAt: me.classroomConnectedAt || null,
      syncedAssignments: synced,
      courses: me.classroomConnectedAt ? listCourses() : [],
    });
  })
);

// A real provider would start OAuth here. The simulation only records the connection.
router.post(
  "/connect",
  ...facultyOnly,
  wrap(async (req, res) => {
    await User.findByIdAndUpdate(req.user.id, { classroomConnectedAt: new Date() });
    res.json({ connected: true, courses: listCourses() });
  })
);

router.post(
  "/sync",
  ...facultyOnly,
  wrap(async (req, res) => {
    const me = await User.findById(req.user.id).lean();
    if (!me.classroomConnectedAt) return res.status(400).json({ error: "Connect Google Classroom first." });
    try {
      res.json(await syncCourse(req.user.id, req.body.courseId));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  })
);

module.exports = router;
