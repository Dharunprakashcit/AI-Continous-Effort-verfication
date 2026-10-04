const Prediction = require("../models/Prediction");
const Activity = require("../models/Activity");

const DAY = 86400000;

function localKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Latest prediction per student, as a Map keyed by student id string.
async function latestByStudent(studentIds) {
  if (!studentIds.length) return new Map();
  const rows = await Prediction.aggregate([
    { $match: { student: { $in: studentIds } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$student", p: { $first: "$$ROOT" } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.p]));
}

// Average contribution per week for a set of students; the latest prediction in a week counts.
async function weeklyTrend(studentIds, weeks = 6) {
  const now = Date.now();
  const since = new Date(now - weeks * 7 * DAY);
  const preds = await Prediction.find({ student: { $in: studentIds }, createdAt: { $gte: since } })
    .select("student contributionScore createdAt")
    .sort({ createdAt: 1 })
    .lean();

  const buckets = Array.from({ length: weeks }, () => new Map());
  for (const p of preds) {
    const age = Math.min(weeks - 1, Math.floor((now - p.createdAt) / (7 * DAY)));
    buckets[weeks - 1 - age].set(String(p.student), p.contributionScore);
  }
  return buckets.map((m, i) => ({
    label: i === weeks - 1 ? "Now" : `${weeks - 1 - i}w ago`,
    value: m.size ? Math.round([...m.values()].reduce((a, b) => a + b, 0) / m.size) : null,
  }));
}

// Per-day activity totals for the last N days, for one student or a whole team.
async function activityByDay(match, days = 7) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const rows = await Activity.find({ ...match, date: { $gte: start } }).lean();
  const out = [];
  const index = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    index.set(localKey(d), out.length);
    out.push({
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      docEdits: 0,
      commits: 0,
      messages: 0,
      replies: 0,
    });
  }
  for (const a of rows) {
    const slot = out[index.get(localKey(new Date(a.date)))];
    if (!slot) continue;
    slot.docEdits += a.docEdits;
    slot.commits += a.commits;
    slot.messages += a.messagesSent;
    slot.replies += a.repliesGiven;
  }
  return out;
}

function riskCounts(predictions) {
  const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const p of predictions) counts[p.riskLevel] += 1;
  return counts;
}

function average(values) {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

module.exports = { latestByStudent, weeklyTrend, activityByDay, riskCounts, average };
