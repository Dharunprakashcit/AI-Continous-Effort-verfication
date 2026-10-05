/**
 * Classroom provider.
 *
 * This is a SIMULATED Google Classroom. A real provider would call
 *   courses.list, courses.courseWork.list and courses.courseWork.studentSubmissions.list
 * with the faculty member's OAuth token and return the same shapes.
 * Google Classroom has no notion of individual versus team work, so the type
 * here is part of the simulated coursework definition.
 */
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Team = require("../models/Team");
const User = require("../models/User");
const { buildRecords } = require("./records");

const DAY = 86400000;

const COURSES = [{ id: "aml", name: "Advanced Machine Learning" }];

const COURSEWORK = {
  aml: [
    { externalId: "cw-1", title: "Linear Regression from Scratch", type: "individual", assignedDaysAgo: 40, dueDaysAgo: 30, description: "Implement linear regression with gradient descent and compare it with a library model." },
    { externalId: "cw-2", title: "Student Performance Prediction", type: "team", assignedDaysAgo: 28, dueDaysAgo: 4, description: "Build and evaluate models that predict student performance from attendance, marks and activity data." },
    { externalId: "cw-3", title: "Neural Network Implementation", type: "individual", assignedDaysAgo: 12, dueDaysAgo: -6, description: "Build a small neural network and report its training behaviour." },
  ],
};

function listCourses() {
  return COURSES;
}

function courseworkFor(courseId, now = Date.now()) {
  return (COURSEWORK[courseId] || []).map((cw) => ({
    ...cw,
    assignedDate: new Date(now - cw.assignedDaysAgo * DAY),
    dueDate: new Date(now - cw.dueDaysAgo * DAY),
    maxScore: 100,
  }));
}

// Deterministic pseudo-random numbers so repeated syncs return the same data.
function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function feedbackFor(score) {
  if (score >= 85) return "Excellent work with clear reasoning.";
  if (score >= 70) return "Good work. Tighten the analysis and presentation.";
  if (score >= 50) return "Meets the basics. Several parts need more depth.";
  return "Below expectations. Please meet the instructor to review the requirements.";
}

function simulateIndividual(assignment, student) {
  const r = rng(`${assignment.externalId}:${student._id}`);
  const marks = student.internalMarks ?? 60;
  const attendance = student.attendancePct ?? 80;
  const pastDue = assignment.dueDate.getTime() < Date.now();
  const chance = clamp((marks - 20) / 80 + 0.32, 0.15, 0.98) * (pastDue ? 1 : 0.45);
  const submitted = r() < chance;
  if (!submitted) return { submitted: false, attempts: 0, late: false };

  const late = pastDue && r() < clamp((1 - attendance / 100) * 1.1 + 0.03, 0.03, 0.5);
  const offset = late ? 1 + r() * 3 : r() * 5;
  const submittedAt = pastDue
    ? new Date(assignment.dueDate.getTime() + (late ? offset : -offset) * DAY)
    : new Date(Date.now() - (0.2 + r() * 3) * DAY);
  const attempts = 1 + Math.floor(r() * (marks < 55 ? 3 : 2));
  const comments = [];
  if (late) comments.push("Turned in after the due date.");
  if (attempts > 1) comments.push(`Resubmitted ${attempts - 1} time${attempts > 2 ? "s" : ""} before grading.`);

  if (!pastDue) {
    return { submitted: true, submittedAt, late: false, attempts, feedback: "Awaiting grading.", comments };
  }
  const score = Math.round(clamp(marks + (r() - 0.5) * 20, 20, 100));
  return { submitted: true, submittedAt, late, score, attempts, feedback: feedbackFor(score), comments };
}

function simulateTeam(assignment, team, members) {
  const pastDue = assignment.dueDate.getTime() < Date.now();
  if (!pastDue) return { team: team._id, submitted: false, late: false };
  const r = rng(`${assignment.externalId}:${team._id}`);
  const avgMarks = members.reduce((a, m) => a + (m.internalMarks ?? 60), 0) / (members.length || 1);
  const late = r() < 0.2;
  const score = Math.round(clamp(avgMarks + 6 + (r() - 0.5) * 14, 30, 98));
  return {
    team: team._id,
    submitted: true,
    submittedAt: new Date(assignment.dueDate.getTime() + (late ? 1 + r() * 2 : -r() * 3) * DAY),
    late,
    score,
    feedback: feedbackFor(score),
  };
}

/**
 * Imports a course's coursework and submissions for a faculty member.
 * Assignments that already exist for the faculty are updated; submissions are rebuilt.
 */
async function syncCourse(facultyId, courseId) {
  const course = COURSES.find((c) => c.id === courseId);
  if (!course) throw new Error("Unknown course");

  const baseTeams = await Team.find({ faculty: facultyId, assignment: null }).populate("members").lean();
  const students = baseTeams.flatMap((t) => t.members);
  const work = courseworkFor(courseId);

  let submissions = 0;
  const imported = [];

  for (const cw of work) {
    const assignment = await Assignment.findOneAndUpdate(
      { faculty: facultyId, externalId: cw.externalId },
      {
        $set: {
          course,
          title: cw.title,
          description: cw.description,
          type: cw.type,
          assignedDate: cw.assignedDate,
          dueDate: cw.dueDate,
          maxScore: cw.maxScore,
          syncedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    if (cw.type === "individual") {
      await Submission.deleteMany({ assignment: assignment._id });
      const docs = students.map((s) => ({ assignment: assignment._id, student: s._id, ...simulateIndividual(assignment, s) }));
      await Submission.insertMany(docs);
      submissions += docs.length;
    } else {
      if (!assignment.teams.length) assignment.teams = baseTeams.map((t) => t._id);
      const formed = await Team.find({ _id: { $in: assignment.teams } }).populate("members").lean();
      assignment.teamSubmissions = formed.map((t) => simulateTeam(assignment, t, t.members));
      await assignment.save();
      submissions += formed.length;
    }
    imported.push({ id: assignment._id, title: assignment.title, type: assignment.type });
  }

  const records = await buildRecords(facultyId);
  return { course, imported, submissions, records };
}

module.exports = { COURSES, COURSEWORK, listCourses, courseworkFor, syncCourse };
