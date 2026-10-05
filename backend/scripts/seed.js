/**
 * Seeds the Advanced Machine Learning demo:
 *
 *   Course: Advanced Machine Learning
 *     Assignment 1  individual   Linear Regression from Scratch
 *     Assignment 2  contributed  Student Performance Prediction
 *         Team 1: Dharun, Arun, Priya
 *         Team 2: Karthik, Meena
 *         Team 3: Sanjay, Divya
 *     Assignment 3  individual   Neural Network Implementation
 *   Naveen and Rekha are not on an Assignment 2 team yet, so they can create one.
 *
 * Assignments stay hidden until the faculty member syncs Google Classroom
 * (simulated). The sync imports submissions and builds the student-assignment
 * feature table used for the academic risk model. Activity, signals, ratings and
 * earlier weekly snapshots are generated demo data.
 *
 * seedDatabase({ extraTeams, runPipeline }) can add many more teams and skip the
 * live agent pipeline, to produce a larger dataset for model training.
 */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../src/models/User");
const Team = require("../src/models/Team");
const Task = require("../src/models/Task");
const Activity = require("../src/models/Activity");
const Prediction = require("../src/models/Prediction");
const Assignment = require("../src/models/Assignment");
const Submission = require("../src/models/Submission");
const Contribution = require("../src/models/Contribution");
const StudentAssignmentRecord = require("../src/models/StudentAssignmentRecord");
const { runPipelineForStudent } = require("../src/agents/orchestrator");
const { courseworkFor } = require("../src/services/classroom");

const BASE_TEAMS = [
  { name: "Team 1", project: "Student Performance Prediction", inA2: true, students: [["Dharun", "23CS001", "strong"], ["Arun", "23CS002", "average"], ["Priya", "23CS003", "declining"]] },
  { name: "Team 2", project: "Student Performance Prediction", inA2: true, students: [["Karthik", "23CS004", "average"], ["Meena", "23CS005", "freerider"]] },
  { name: "Team 3", project: "Student Performance Prediction", inA2: true, students: [["Sanjay", "23CS006", "strong"], ["Divya", "23CS007", "improving"]] },
  { name: "Team 4", project: "Awaiting team formation", inA2: false, students: [["Naveen", "23CS008", "average"], ["Rekha", "23CS009", "freerider"]] },
];

const PATTERNS = {
  strong: { docEdits: [4, 6], commits: [2, 4], messagesSent: [3, 5], repliesGiven: [1, 3], active: 0.8, taskCompletion: 0.9,
    academic: { att: [90, 98], marks: [75, 92], gpa: [8.2, 9.4] }, signals: { commits: [22, 36], prs: [4, 8], files: [14, 26], docs: [3, 6], peer: [4.2, 4.9], faculty: [4.1, 4.9] } },
  improving: { docEdits: [3, 5], commits: [1, 3], messagesSent: [2, 4], repliesGiven: [1, 2], active: 0.65, taskCompletion: 0.75,
    academic: { att: [80, 90], marks: [65, 80], gpa: [7.4, 8.4] }, signals: { commits: [14, 24], prs: [3, 6], files: [9, 18], docs: [2, 5], peer: [3.7, 4.4], faculty: [3.6, 4.4] } },
  average: { docEdits: [2, 4], commits: [1, 2], messagesSent: [1, 3], repliesGiven: [0, 2], active: 0.6, taskCompletion: 0.6,
    academic: { att: [75, 88], marks: [55, 72], gpa: [6.8, 7.8] }, signals: { commits: [10, 18], prs: [2, 4], files: [6, 13], docs: [1, 3], peer: [3.2, 4.0], faculty: [3.2, 4.0] } },
  declining: { docEdits: [0, 2], commits: [0, 1], messagesSent: [0, 2], repliesGiven: [0, 1], active: 0.45, taskCompletion: 0.4,
    academic: { att: [62, 78], marks: [42, 60], gpa: [6.0, 7.2] }, signals: { commits: [5, 10], prs: [1, 2], files: [3, 8], docs: [0, 2], peer: [2.6, 3.4], faculty: [2.6, 3.4] } },
  freerider: { docEdits: [0, 1], commits: [0, 0], messagesSent: [0, 1], repliesGiven: [0, 0], active: 0.25, taskCompletion: 0.15,
    academic: { att: [50, 70], marks: [30, 52], gpa: [5.0, 6.4] }, signals: { commits: [0, 4], prs: [0, 1], files: [0, 3], docs: [0, 1], peer: [1.5, 2.6], faculty: [1.5, 2.6] } },
};

// Task titles for the team assignment, one list per member slot.
const TASK_POOLS = [
  ["Data cleaning", "Feature engineering", "Exploratory analysis", "Train-test split"],
  ["Baseline models", "Hyperparameter tuning", "Model comparison", "Cross-validation"],
  ["Evaluation metrics", "Report writing", "Presentation slides", "Error analysis"],
];
const STARTER_TASKS = ["Literature review", "Dataset collection", "Draft proposal"];

const DAY = 86400000;
const randInt = ([min, max]) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = ([min, max]) => Math.round((min + Math.random() * (max - min)) * 10) / 10;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function levelFor(overallRisk) {
  if (overallRisk < 30) return { riskLevel: "LOW", decision: "ALLOW" };
  if (overallRisk <= 70) return { riskLevel: "MEDIUM", decision: "NUDGE" };
  return { riskLevel: "HIGH", decision: "ALERT" };
}

function pickPattern() {
  const r = Math.random();
  return r < 0.25 ? "strong" : r < 0.6 ? "average" : r < 0.72 ? "improving" : r < 0.87 ? "declining" : "freerider";
}

// Extra teams for a large training dataset.
function extraTeamSpecs(n) {
  let counter = 0;
  return Array.from({ length: n }, (_, i) => ({
    name: `Cohort Team ${i + 1}`,
    project: "Student Performance Prediction",
    inA2: true,
    students: Array.from({ length: 3 + (i % 2) }, () => {
      counter += 1;
      return [`Student ${String(counter).padStart(3, "0")}`, `24CS${String(counter).padStart(3, "0")}`, pickPattern()];
    }),
  }));
}

// Earlier weekly snapshots that lead up to the live prediction (generated demo data).
async function seedHistory(student, team, pattern) {
  const latest = await Prediction.findOne({ student: student._id }).sort({ createdAt: -1 }).lean();
  if (!latest) return;
  const trendPerWeek = { declining: 7, freerider: 3, improving: -6, strong: 0, average: 0 }[pattern];
  const noise = pattern === "strong" || pattern === "average" ? 4 : 2;
  for (let w = 1; w <= 5; w++) {
    const score = clamp(latest.contributionScore + trendPerWeek * w + randInt([-noise, noise]), 3, 98);
    const overallRisk = 100 - score;
    await Prediction.create({
      student: student._id,
      team: team._id,
      editScore: clamp(latest.editScore + randInt([-8, 8]), 0, 100),
      taskScore: clamp(latest.taskScore + randInt([-8, 8]), 0, 100),
      communicationScore: clamp(latest.communicationScore + randInt([-8, 8]), 0, 100),
      annRiskProbability: overallRisk / 100,
      overallRisk,
      contributionScore: score,
      ...levelFor(overallRisk),
      explanations: ["Earlier weekly snapshot (generated demo data)."],
      recommendation: "Historical record.",
      createdAt: new Date(Date.now() - w * 7 * DAY - randInt([0, 20]) * 3600000),
    });
  }
}

async function seedDatabase({ extraTeams = 0, runPipeline = true } = {}) {
  console.log("Clearing existing demo collections...");
  await Promise.all(
    [User, Team, Task, Activity, Prediction, Assignment, Submission, Contribution, StudentAssignmentRecord].map((m) => m.deleteMany({}))
  );

  const passwordHash = await bcrypt.hash("password123", 10);
  const faculty = await User.create({ name: "Dr. Vishnu Menon", email: "faculty@example.edu", passwordHash, role: "faculty" });

  const specs = [...BASE_TEAMS, ...extraTeamSpecs(extraTeams)];
  const groups = [];
  const everyone = [];

  for (const spec of specs) {
    const team = await Team.create({ name: spec.name, projectTitle: spec.project, faculty: faculty._id, members: [] });
    const members = [];
    for (const [name, registerNo, pattern] of spec.students) {
      const a = PATTERNS[pattern].academic;
      const doc = await User.create({
        name,
        email: `${registerNo.toLowerCase()}@example.edu`,
        passwordHash,
        role: "student",
        registerNo,
        team: team._id,
        attendancePct: randInt(a.att),
        internalMarks: randInt(a.marks),
        previousGpa: randFloat(a.gpa),
      });
      members.push({ doc, pattern, name });
    }
    team.members = members.map((m) => m.doc._id);
    await team.save();
    groups.push({ team, members, inA2: spec.inA2 });
    members.forEach((m) => everyone.push({ ...m, team }));
  }

  // Assignments exist from the start but stay hidden until a Classroom sync.
  const assignments = {};
  for (const cw of courseworkFor("aml")) {
    assignments[cw.externalId] = await Assignment.create({
      faculty: faculty._id,
      course: { id: "aml", name: "Advanced Machine Learning" },
      externalId: cw.externalId,
      title: cw.title,
      description: cw.description,
      type: cw.type,
      assignedDate: cw.assignedDate,
      dueDate: cw.dueDate,
      maxScore: cw.maxScore,
      teams: cw.type === "team" ? groups.filter((g) => g.inA2).map((g) => g.team._id) : [],
    });
  }
  const a2 = assignments["cw-2"];
  const a2Past = a2.dueDate.getTime() < Date.now();

  for (const { team, members, inA2 } of groups) {
    for (const [slot, m] of members.entries()) {
      const p = PATTERNS[m.pattern];

      if (inA2) {
        for (const title of TASK_POOLS[slot % TASK_POOLS.length]) {
          const done = Math.random() < p.taskCompletion;
          await Task.create({
            title,
            team: team._id,
            assignment: a2._id,
            assignedTo: m.doc._id,
            deadline: a2.dueDate,
            status: done ? "Completed" : a2Past ? "Late" : "In Progress",
            completedAt: done ? new Date(a2.dueDate.getTime() - DAY * (1 + Math.random() * 4)) : undefined,
          });
        }
        const s = p.signals;
        await Contribution.create({
          assignment: a2._id,
          team: team._id,
          student: m.doc._id,
          commits: randInt(s.commits),
          pullRequests: randInt(s.prs),
          filesModified: randInt(s.files),
          docPages: randInt(s.docs),
          peerRating: randFloat(s.peer),
          facultyRating: randFloat(s.faculty),
        });
      } else {
        for (const title of STARTER_TASKS) {
          const done = Math.random() < p.taskCompletion;
          await Task.create({
            title,
            team: team._id,
            assignedTo: m.doc._id,
            deadline: new Date(Date.now() + 7 * DAY),
            status: done ? "Completed" : "In Progress",
            completedAt: done ? new Date() : undefined,
          });
        }
      }

      // 30 days of activity so assignment windows have real numbers.
      for (let d = 0; d < 30; d++) {
        if (Math.random() > p.active) continue;
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - d);
        await Activity.create({
          student: m.doc._id,
          team: team._id,
          date,
          docEdits: randInt(p.docEdits),
          commits: randInt(p.commits),
          messagesSent: randInt(p.messagesSent),
          repliesGiven: randInt(p.repliesGiven),
          activeMinutes: randInt([10, 90]),
        });
      }
    }
  }

  if (runPipeline) {
    console.log("Running agent pipeline for each student...");
    for (const s of everyone) {
      try {
        await runPipelineForStudent(s.doc._id, s.team._id);
        await seedHistory(s.doc, s.team, s.pattern);
      } catch (err) {
        console.warn(`Prediction failed for ${s.name}:`, err.message);
      }
    }
  }

  console.log("\nSeed complete.");
  console.log("Faculty login:  faculty@example.edu / password123");
  console.log("Student logins: 23cs001@example.edu ... 23cs009@example.edu / password123");
  console.log("Assignments appear after the faculty connects Google Classroom (simulated) and syncs.");

  return { faculty };
}

if (require.main === module) {
  require("dotenv").config();
  const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/contribution_monitoring";

  mongoose
    .connect(MONGO_URI)
    .then(() => seedDatabase())
    .then(() => mongoose.disconnect())
    .catch(async (err) => {
      console.error(err);
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { seedDatabase };
