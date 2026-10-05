const router = require("express").Router();
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Team = require("../models/Team");
const { requireAuth, requireRole } = require("../middleware/auth");
const { teamBreakdown, memberSignals } = require("../services/contribution");
const { availableStudents, createTeam, studentFaculty } = require("../services/teams");
const { activityByDay } = require("../services/stats");

const studentOnly = [requireAuth, requireRole("student")];
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const header = (a) => ({
  id: a._id,
  title: a.title,
  description: a.description,
  type: a.type,
  course: a.course?.name,
  assignedDate: a.assignedDate,
  dueDate: a.dueDate,
  maxScore: a.maxScore,
});

async function visibleAssignment(req) {
  const { facultyId } = await studentFaculty(req.user.id);
  if (!facultyId) return null;
  return Assignment.findOne({ _id: req.params.id, faculty: facultyId, syncedAt: { $ne: null } }).lean();
}

const myTeamIn = (a, studentId) => Team.findOne({ _id: { $in: a.teams }, members: studentId }).lean();

// All synced assignments, individual and team, for the student's faculty.
router.get(
  "/",
  ...studentOnly,
  wrap(async (req, res) => {
    const { facultyId } = await studentFaculty(req.user.id);
    if (!facultyId) return res.json([]);
    const assignments = await Assignment.find({ faculty: facultyId, syncedAt: { $ne: null } }).sort({ assignedDate: 1 }).lean();
    const subs = await Submission.find({ student: req.user.id, assignment: { $in: assignments.map((a) => a._id) } }).lean();

    const out = [];
    for (const a of assignments) {
      if (a.type === "individual") {
        const s = subs.find((x) => String(x.assignment) === String(a._id));
        out.push({ ...header(a), submitted: !!s?.submitted, late: !!s?.late, score: s?.score ?? null });
      } else {
        const mine = await myTeamIn(a, req.user.id);
        out.push({ ...header(a), teamCount: a.teams.length, myTeam: mine ? { id: mine._id, name: mine.name } : null });
      }
    }
    res.json(out);
  })
);

router.get(
  "/:id",
  ...studentOnly,
  wrap(async (req, res) => {
    const a = await visibleAssignment(req);
    if (!a) return res.status(404).json({ error: "Assignment not found" });

    if (a.type === "individual") {
      const s = await Submission.findOne({ assignment: a._id, student: req.user.id }).lean();
      const days = await activityByDay({ student: req.user.id }, 14);
      return res.json({
        kind: "individual",
        assignment: header(a),
        submission: s || { submitted: false, attempts: 0, comments: [] },
        activity: days,
      });
    }

    const teams = await Team.find({ _id: { $in: a.teams } }).lean();
    const mine = teams.find((t) => t.members.some((m) => String(m) === String(req.user.id)));
    res.json({
      kind: "team",
      assignment: header(a),
      teams: teams.map((t) => ({ id: t._id, name: t.name, memberCount: t.members.length, isMine: mine && String(mine._id) === String(t._id) })),
      myTeamId: mine?._id || null,
      canCreateTeam: !mine,
    });
  })
);

router.get(
  "/:id/available-students",
  ...studentOnly,
  wrap(async (req, res) => {
    const a = await visibleAssignment(req);
    if (!a || a.type !== "team") return res.status(404).json({ error: "Team assignment not found" });
    const list = await availableStudents(a);
    res.json(list.map((s) => ({ id: s._id, name: s.name, isMe: String(s._id) === String(req.user.id) })));
  })
);

// A student creates a team for themselves and chosen classmates. No percentages are accepted.
router.post(
  "/:id/teams",
  ...studentOnly,
  wrap(async (req, res) => {
    const a = await visibleAssignment(req);
    if (!a) return res.status(404).json({ error: "Assignment not found" });
    if (await myTeamIn(a, req.user.id)) return res.status(400).json({ error: "You are already on a team for this assignment." });

    const memberIds = [...new Set([String(req.user.id), ...(req.body.memberIds || []).map(String)])];
    try {
      const team = await createTeam(a, { name: req.body.name, memberIds });
      res.status(201).json({ id: team._id, name: team.name });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  })
);

// Students open only their own team. Other teams show a name and size, nothing more.
async function ownTeam(req, a) {
  const mine = await myTeamIn(a, req.user.id);
  return mine && String(mine._id) === req.params.teamId ? mine : null;
}

router.get(
  "/:id/teams/:teamId",
  ...studentOnly,
  wrap(async (req, res) => {
    const a = await visibleAssignment(req);
    if (!a || a.type !== "team") return res.status(404).json({ error: "Assignment not found" });
    if (!(await ownTeam(req, a))) return res.status(403).json({ error: "You can only open your own team." });

    const b = await teamBreakdown(a, req.params.teamId);
    res.json({
      assignment: header(a),
      team: b.team,
      rows: b.rows
        .map((r) => ({ student: { id: r.student.id, name: r.student.name }, contribution: r.contribution, isMe: String(r.student.id) === String(req.user.id) }))
        .sort((x, y) => (y.contribution ?? -1) - (x.contribution ?? -1)),
    });
  })
);

router.get(
  "/:id/teams/:teamId/members/:studentId",
  ...studentOnly,
  wrap(async (req, res) => {
    const a = await visibleAssignment(req);
    if (!a || a.type !== "team") return res.status(404).json({ error: "Assignment not found" });
    if (!(await ownTeam(req, a))) return res.status(403).json({ error: "You can only open your own team." });

    const b = await teamBreakdown(a, req.params.teamId);
    const row = b.rows.find((r) => String(r.student.id) === req.params.studentId);
    if (!row) return res.status(404).json({ error: "Member not found" });
    res.json({
      assignment: header(a),
      team: b.team,
      student: { id: row.student.id, name: row.student.name, isMe: String(row.student.id) === String(req.user.id) },
      estimate: row.contribution,
      signals: memberSignals(row, b.rows),
    });
  })
);

module.exports = router;
