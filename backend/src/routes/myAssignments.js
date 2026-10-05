const router = require("express").Router();
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Team = require("../models/Team");
const StudentAssignmentRecord = require("../models/StudentAssignmentRecord");
const { requireAuth, requireRole } = require("../middleware/auth");
const { teamBreakdown } = require("../services/contribution");
const { activityLevel, activityScore, windowDaysFor } = require("../services/records");
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

const memberRows = (b, myId) =>
  b.rows
    .map((r) => ({ id: r.student.id, name: r.student.name, contribution: r.contribution, isMe: String(r.student.id) === String(myId) }))
    .sort((x, y) => (y.contribution ?? -1) - (x.contribution ?? -1));

// All synced assignments, with the fields each tab needs.
router.get(
  "/",
  ...studentOnly,
  wrap(async (req, res) => {
    const { facultyId } = await studentFaculty(req.user.id);
    if (!facultyId) return res.json([]);
    const assignments = await Assignment.find({ faculty: facultyId, syncedAt: { $ne: null } }).sort({ assignedDate: 1 }).lean();
    const ids = assignments.map((a) => a._id);
    const [subs, records] = await Promise.all([
      Submission.find({ student: req.user.id, assignment: { $in: ids } }).lean(),
      StudentAssignmentRecord.find({ student: req.user.id, assignment: { $in: ids } }).lean(),
    ]);

    const out = [];
    for (const a of assignments) {
      const rec = records.find((r) => String(r.assignment) === String(a._id));
      if (a.type === "individual") {
        const s = subs.find((x) => String(x.assignment) === String(a._id));
        out.push({
          ...header(a),
          submitted: !!s?.submitted,
          late: !!s?.late,
          score: s?.score ?? null,
          feedback: s?.feedback ?? null,
          activity: rec ? { score: rec.activityScore, level: activityLevel(rec.activityScore) } : null,
        });
      } else {
        const mine = await myTeamIn(a, req.user.id);
        let team = null;
        if (mine) {
          const b = await teamBreakdown(a, mine._id);
          const rows = memberRows(b, req.user.id);
          team = { id: mine._id, name: mine.name, members: rows.map((r) => r.name), myContribution: rows.find((r) => r.isMe)?.contribution ?? null };
        }
        out.push({ ...header(a), team });
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
      return res.json({
        kind: "individual",
        assignment: header(a),
        submission: s || { submitted: false, attempts: 0, comments: [] },
        activity: await activityByDay({ student: req.user.id }, 14),
      });
    }

    const teams = await Team.find({ _id: { $in: a.teams } }).lean();
    const mine = teams.find((t) => t.members.some((m) => String(m) === String(req.user.id)));
    let myTeam = null;
    if (mine) {
      const b = await teamBreakdown(a, mine._id);
      myTeam = { id: mine._id, name: mine.name, members: memberRows(b, req.user.id) };
    }
    res.json({
      kind: "team",
      assignment: header(a),
      myTeam,
      otherTeams: teams.filter((t) => !mine || String(t._id) !== String(mine._id)).map((t) => ({ id: t._id, name: t.name, memberCount: t.members.length })),
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

// Students open only their own team's members.
router.get(
  "/:id/members/:studentId",
  ...studentOnly,
  wrap(async (req, res) => {
    const a = await visibleAssignment(req);
    if (!a || a.type !== "team") return res.status(404).json({ error: "Assignment not found" });
    const mine = await myTeamIn(a, req.user.id);
    if (!mine) return res.status(403).json({ error: "You can only open your own team." });

    const b = await teamBreakdown(a, mine._id);
    const row = b.rows.find((r) => String(r.student.id) === req.params.studentId);
    if (!row) return res.status(404).json({ error: "Member not found on your team" });

    const score = activityScore(row.activity, windowDaysFor(a));
    res.json({
      assignment: header(a),
      team: b.team,
      student: { id: row.student.id, name: row.student.name, isMe: String(row.student.id) === String(req.user.id) },
      estimate: row.contribution,
      signals: {
        commentsDiscussions: row.activity.messages + row.activity.replies,
        relevantInteractions: row.activity.replies,
        tasksCompleted: row.tasksDone,
        submissions: row.git.commits,
        projectActivity: activityLevel(score),
      },
    });
  })
);

module.exports = router;
