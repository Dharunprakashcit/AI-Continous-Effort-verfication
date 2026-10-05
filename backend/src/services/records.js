const Assignment = require("../models/Assignment");
const Activity = require("../models/Activity");
const Submission = require("../models/Submission");
const Team = require("../models/Team");
const StudentAssignmentRecord = require("../models/StudentAssignmentRecord");
const { teamBreakdown } = require("./contribution");

const DAY = 86400000;

// The faculty member's students, taken from their project teams.
async function cohortFor(facultyId) {
  const teams = await Team.find({ faculty: facultyId, assignment: null }).populate("members").lean();
  return teams.flatMap((t) => t.members);
}

// 0 to 100. Half from how many days the student was active, half from how much they did.
function activityScore({ days, docEdits, commits, messages, replies }, windowDays) {
  const regularity = Math.min(1, days / Math.max(1, 0.7 * windowDays));
  const volume = Math.min(1, (docEdits + commits + messages + replies) / (windowDays * 14));
  return Math.round(50 * regularity + 50 * volume);
}

function sumActivity(rows) {
  return {
    days: new Set(rows.map((a) => new Date(a.date).toDateString())).size,
    docEdits: rows.reduce((s, a) => s + a.docEdits, 0),
    commits: rows.reduce((s, a) => s + a.commits, 0),
    messages: rows.reduce((s, a) => s + a.messagesSent, 0),
    replies: rows.reduce((s, a) => s + a.repliesGiven, 0),
  };
}

async function buildAssignmentRecords(assignment, cohort) {
  const students = cohort || (await cohortFor(assignment.faculty));
  const ids = students.map((s) => s._id);
  const windowDays = windowDaysFor(assignment);
  const activities = await Activity.find({ student: { $in: ids }, date: { $gte: assignment.assignedDate } }).lean();

  const common = (s) => {
    const act = sumActivity(activities.filter((a) => String(a.student) === String(s._id)));
    return {
      act,
      base: {
        student: s._id,
        assignment: assignment._id,
        assignmentType: assignment.type === "team" ? "contributed" : "individual",
        attendance: s.attendancePct,
        commentsCount: act.messages + act.replies,
        relevantComments: act.replies,
        activityScore: activityScore(act, windowDays),
      },
    };
  };

  const docs = [];

  if (assignment.type === "individual") {
    const subs = await Submission.find({ assignment: assignment._id }).lean();
    for (const s of students) {
      const sub = subs.find((x) => String(x.student) === String(s._id));
      const { act, base } = common(s);
      docs.push({
        ...base,
        team: null,
        assignmentScore: sub?.score ?? null,
        submissionStatus: sub?.submitted ? (sub.late ? "late" : "submitted") : "missing",
        lateSubmission: !!sub?.late,
        tasksCompleted: 0,
        projectInteractions: act.docEdits + act.commits,
        contributionScore: sub?.submitted ? 100 : 0,
      });
    }
  } else {
    const rowByStudent = new Map();
    const teamOf = new Map();
    for (const teamId of assignment.teams) {
      const b = await teamBreakdown(assignment, teamId);
      if (!b) continue;
      const sub = (assignment.teamSubmissions || []).find((x) => String(x.team) === String(teamId)) || {};
      for (const r of b.rows) {
        rowByStudent.set(String(r.student.id), r);
        teamOf.set(String(r.student.id), { id: teamId, sub });
      }
    }
    for (const s of students) {
      const { base } = common(s);
      const row = rowByStudent.get(String(s._id));
      const t = teamOf.get(String(s._id));
      docs.push({
        ...base,
        team: t?.id ?? null,
        assignmentScore: t?.sub.score ?? null,
        submissionStatus: t?.sub.submitted ? (t.sub.late ? "late" : "submitted") : "missing",
        lateSubmission: !!t?.sub.late,
        tasksCompleted: row?.tasksDone ?? 0,
        projectInteractions: row ? row.git.commits + row.git.pullRequests + row.docs.pages : 0,
        contributionScore: row?.contribution ?? null,
      });
    }
  }

  await StudentAssignmentRecord.deleteMany({ assignment: assignment._id });
  await StudentAssignmentRecord.insertMany(docs);
  return docs.length;
}

async function buildRecords(facultyId) {
  const cohort = await cohortFor(facultyId);
  const assignments = await Assignment.find({ faculty: facultyId, syncedAt: { $ne: null } }).lean();
  let rows = 0;
  for (const a of assignments) rows += await buildAssignmentRecords(a, cohort);
  return rows;
}

const COLUMNS = [
  "student_id", "assignment_id", "assignment_type", "team_id", "attendance", "assignment_score",
  "submission_status", "late_submission", "comments_count", "relevant_comments", "tasks_completed",
  "project_interactions", "activity_score", "contribution_score",
];

const cell = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function recordsToCsv(facultyId) {
  const assignments = await Assignment.find({ faculty: facultyId, syncedAt: { $ne: null } }).lean();
  const records = await StudentAssignmentRecord.find({ assignment: { $in: assignments.map((a) => a._id) } })
    .populate("student", "registerNo")
    .populate("team", "name")
    .lean();
  const ext = new Map(assignments.map((a) => [String(a.assignment ?? a._id), a.externalId]));

  const lines = records.map((r) =>
    [
      r.student.registerNo,
      ext.get(String(r.assignment)),
      r.assignmentType,
      r.team?.name ?? "",
      r.attendance,
      r.assignmentScore,
      r.submissionStatus,
      r.lateSubmission ? 1 : 0,
      r.commentsCount,
      r.relevantComments,
      r.tasksCompleted,
      r.projectInteractions,
      r.activityScore,
      r.contributionScore,
    ]
      .map(cell)
      .join(",")
  );
  return [COLUMNS.join(","), ...lines].join("\n");
}

const windowDaysFor = (assignment) =>
  Math.max(1, Math.min(30, Math.ceil((Date.now() - new Date(assignment.assignedDate)) / DAY)));

const activityLevel = (score) => (score >= 70 ? "High" : score >= 40 ? "Medium" : "Low");

module.exports = { cohortFor, buildAssignmentRecords, buildRecords, recordsToCsv, activityScore, windowDaysFor, activityLevel };
