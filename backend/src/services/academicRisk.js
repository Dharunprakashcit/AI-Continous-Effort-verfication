const axios = require("axios");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Task = require("../models/Task");
const User = require("../models/User");
const { teamBreakdown } = require("./contribution");

const ANN_URL = process.env.ANN_SERVICE_URL || "http://127.0.0.1:5001";

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Builds the model's inputs from stored attendance, marks, submissions, tasks and team work.
async function academicFeatures(studentId) {
  const student = await User.findById(studentId).lean();
  const individual = await Assignment.find({ type: "individual", syncedAt: { $ne: null } }).lean();
  const subs = await Submission.find({ student: studentId, assignment: { $in: individual.map((a) => a._id) } }).lean();

  const submitted = subs.filter((s) => s.submitted);
  const scored = submitted.filter((s) => s.score != null);

  const teamWork = await Assignment.find({ type: "team", syncedAt: { $ne: null }, teams: student.team }).lean();
  const ratios = [];
  for (const a of teamWork) {
    const b = await teamBreakdown(a, student.team);
    const row = b?.rows.find((r) => String(r.student.id) === String(studentId));
    if (row && b.rows.length) ratios.push((row.contribution / 100) * b.rows.length);
  }

  const tasks = await Task.find({ assignedTo: studentId }).lean();
  const tasksDone = tasks.filter((t) => t.status === "Completed").length;

  return {
    attendance_pct: student.attendancePct ?? 80,
    internal_marks: student.internalMarks ?? 60,
    previous_gpa: student.previousGpa ?? 7,
    submission_rate_pct: individual.length ? Math.round((submitted.length / individual.length) * 100) : 100,
    late_submissions: submitted.filter((s) => s.late).length,
    avg_assignment_score: Math.round(mean(scored.map((s) => s.score)) ?? student.internalMarks ?? 60),
    contribution_ratio: Math.round((mean(ratios) ?? 1) * 100) / 100,
    tasks_completed_pct: tasks.length ? Math.round((tasksDone / tasks.length) * 100) : 100,
  };
}

// Same latent formula the model was trained against, used when the service is offline.
function heuristicProbability(f) {
  const latent =
    0.2 * (1 - f.attendance_pct / 100) +
    0.22 * (1 - f.internal_marks / 100) +
    0.14 * (1 - f.previous_gpa / 10) +
    0.14 * (1 - f.submission_rate_pct / 100) +
    0.06 * Math.min(f.late_submissions / 4, 1) +
    0.1 * (1 - f.avg_assignment_score / 100) +
    0.08 * (1 - Math.min(f.contribution_ratio, 1.2) / 1.2) +
    0.06 * (1 - f.tasks_completed_pct / 100);
  return 1 / (1 + Math.exp(-(latent - 0.33) / 0.045));
}

function factorsFor(f) {
  const out = [];
  if (f.attendance_pct < 75) out.push(`Attendance is ${f.attendance_pct}%, below 75%.`);
  if (f.internal_marks < 50) out.push(`Internal marks are ${f.internal_marks}, below 50.`);
  if (f.previous_gpa < 6) out.push(`Previous GPA is ${f.previous_gpa}, below 6.0.`);
  if (f.submission_rate_pct < 70) out.push(`Only ${f.submission_rate_pct}% of individual assignments were submitted.`);
  if (f.late_submissions >= 2) out.push(`${f.late_submissions} late submissions.`);
  if (f.avg_assignment_score < 50) out.push(`Average assignment score is ${f.avg_assignment_score}.`);
  if (f.contribution_ratio < 0.6) out.push("Team contribution is well below an equal share.");
  if (f.tasks_completed_pct < 50) out.push(`Only ${f.tasks_completed_pct}% of assigned tasks are completed.`);
  if (!out.length) out.push("No single factor stands out as a concern.");
  return out;
}

async function predictAcademicRisk(studentId) {
  const features = await academicFeatures(studentId);
  let probability;
  let source = "model";
  let modelVersion = null;
  try {
    const { data } = await axios.post(`${ANN_URL}/academic/predict`, features, { timeout: 3000 });
    probability = data.risk_probability;
    modelVersion = data.model_version;
  } catch {
    probability = heuristicProbability(features);
    source = "fallback-heuristic";
  }
  const level = probability < 0.3 ? "LOW" : probability <= 0.7 ? "MEDIUM" : "HIGH";
  return { probability: Math.round(probability * 1000) / 1000, level, source, modelVersion, features, factors: factorsFor(features) };
}

module.exports = { academicFeatures, predictAcademicRisk };
