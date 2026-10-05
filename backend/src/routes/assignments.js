const router = require("express").Router();
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Team = require("../models/Team");
const User = require("../models/User");
const Task = require("../models/Task");
const { requireAuth, requireRole } = require("../middleware/auth");
const { teamBreakdown, WEIGHTS } = require("../services/contribution");
const { predictAcademicRisk } = require("../services/academicRisk");
const { activityByDay } = require("../services/stats");

const facultyOnly = [requireAuth, requireRole("faculty")];
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

async function ownedAssignment(req) {
  return Assignment.findOne({ _id: req.params.id, faculty: req.user.id, syncedAt: { $ne: null } }).lean();
}

async function facultyStudents(facultyId) {
  const teams = await Team.find({ faculty: facultyId }).populate("members", "name registerNo").lean();
  return { teams, students: teams.flatMap((t) => t.members.map((m) => ({ ...m, teamName: t.name, teamId: t._id }))) };
}

const assignmentHeader = (a) => ({
  id: a._id,
  title: a.title,
  description: a.description,
  type: a.type,
  course: a.course?.name,
  assignedDate: a.assignedDate,
  dueDate: a.dueDate,
  maxScore: a.maxScore,
  syncedAt: a.syncedAt,
});

router.get(
  "/",
  ...facultyOnly,
  wrap(async (req, res) => {
    const assignments = await Assignment.find({ faculty: req.user.id, syncedAt: { $ne: null } }).sort({ assignedDate: 1 }).lean();
    const { students } = await facultyStudents(req.user.id);

    const out = await Promise.all(
      assignments.map(async (a) => {
        if (a.type === "individual") {
          const subs = await Submission.find({ assignment: a._id }).lean();
          const submitted = subs.filter((s) => s.submitted);
          return {
            ...assignmentHeader(a),
            totals: {
              students: students.length,
              submitted: submitted.length,
              late: submitted.filter((s) => s.late).length,
              avgScore: avg(submitted.filter((s) => s.score != null).map((s) => s.score)),
            },
          };
        }
        const subs = a.teamSubmissions || [];
        return {
          ...assignmentHeader(a),
          totals: {
            teams: a.teams.length,
            submitted: subs.filter((s) => s.submitted).length,
            late: subs.filter((s) => s.submitted && s.late).length,
            avgScore: avg(subs.filter((s) => s.score != null).map((s) => s.score)),
          },
        };
      })
    );
    res.json(out);
  })
);

router.get(
  "/:id",
  ...facultyOnly,
  wrap(async (req, res) => {
    const a = await ownedAssignment(req);
    if (!a) return res.status(404).json({ error: "Assignment not found" });

    if (a.type === "individual") {
      const { students } = await facultyStudents(req.user.id);
      const subs = await Submission.find({ assignment: a._id }).lean();
      const byStudent = new Map(subs.map((s) => [String(s.student), s]));
      const rows = students.map((s) => {
        const sub = byStudent.get(String(s._id));
        return {
          student: { id: s._id, name: s.name, registerNo: s.registerNo, teamName: s.teamName },
          submitted: !!sub?.submitted,
          late: !!sub?.late,
          score: sub?.score ?? null,
          attempts: sub?.attempts ?? 0,
          contribution: sub?.submitted ? 100 : 0,
        };
      });
      return res.json({ assignment: assignmentHeader(a), rows });
    }

    const teams = await Team.find({ _id: { $in: a.teams } }).lean();
    const rows = await Promise.all(
      teams.map(async (t) => {
        const sub = (a.teamSubmissions || []).find((s) => String(s.team) === String(t._id));
        const b = await teamBreakdown(a, t._id);
        const shares = b.rows.map((r) => r.contribution);
        const top = b.rows.reduce((m, r) => (r.contribution > m.contribution ? r : m), b.rows[0]);
        const low = b.rows.reduce((m, r) => (r.contribution < m.contribution ? r : m), b.rows[0]);
        return {
          team: { id: t._id, name: t.name, projectTitle: t.projectTitle },
          memberCount: t.members.length,
          submitted: !!sub?.submitted,
          late: !!sub?.late,
          score: sub?.score ?? null,
          highest: top ? { name: top.student.name, share: top.contribution } : null,
          lowest: low ? { name: low.student.name, share: low.contribution } : null,
          spread: shares.length ? Math.max(...shares) - Math.min(...shares) : 0,
        };
      })
    );
    res.json({ assignment: assignmentHeader(a), rows, weights: Object.entries(WEIGHTS).map(([k, w]) => ({ key: k, weight: Math.round(w * 100) })) });
  })
);

router.get(
  "/:id/teams/:teamId",
  ...facultyOnly,
  wrap(async (req, res) => {
    const a = await ownedAssignment(req);
    if (!a || a.type !== "team" || !a.teams.some((t) => String(t) === req.params.teamId)) {
      return res.status(404).json({ error: "Team not found for this assignment" });
    }
    const b = await teamBreakdown(a, req.params.teamId);
    const sub = (a.teamSubmissions || []).find((s) => String(s.team) === req.params.teamId) || {};
    res.json({ assignment: assignmentHeader(a), submission: sub, ...b });
  })
);

router.get(
  "/:id/students/:studentId",
  ...facultyOnly,
  wrap(async (req, res) => {
    const a = await ownedAssignment(req);
    if (!a) return res.status(404).json({ error: "Assignment not found" });
    const student = await User.findById(req.params.studentId).populate("team", "name").lean();
    if (!student) return res.status(404).json({ error: "Student not found" });

    const academicRisk = await predictAcademicRisk(student._id);
    const base = {
      assignment: assignmentHeader(a),
      student: { id: student._id, name: student.name, registerNo: student.registerNo, teamId: student.team?._id, teamName: student.team?.name },
      academicRisk,
    };

    if (a.type === "individual") {
      const sub = await Submission.findOne({ assignment: a._id, student: student._id }).lean();
      return res.json({
        ...base,
        kind: "individual",
        submission: sub || { submitted: false, attempts: 0 },
        activityByDay: await activityByDay({ student: student._id }),
      });
    }

    const b = await teamBreakdown(a, student.team?._id);
    const row = b?.rows.find((r) => String(r.student.id) === String(student._id));
    if (!row) return res.status(404).json({ error: "Student is not on a team for this assignment" });
    const tasks = await Task.find({ assignment: a._id, assignedTo: student._id }).lean();
    res.json({
      ...base,
      kind: "team",
      contribution: row,
      teamSize: b.rows.length,
      tasks: tasks.map((t) => ({ title: t.title, status: t.status })),
      weights: b.weights,
    });
  })
);

module.exports = router;
