/**
 * Seeds demo data: 1 faculty, 4 teams, 17 students with deliberately different
 * contribution patterns, tasks, 7 days of activity, a live pipeline run per
 * student, and 5 weeks of earlier prediction snapshots.
 *
 * The earlier snapshots are generated demo data (real history would accumulate
 * as the pipeline runs). They exist so trend charts have something to show.
 *
 * Exports seedDatabase() so both `npm run seed` and the zero-setup demo runner
 * (`npm run demo`) can reuse it against an already-connected mongoose instance.
 */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../src/models/User");
const Team = require("../src/models/Team");
const Task = require("../src/models/Task");
const Activity = require("../src/models/Activity");
const Prediction = require("../src/models/Prediction");
const { runPipelineForStudent } = require("../src/agents/orchestrator");

const TEAMS = [
  {
    name: "Team Alpha",
    project: "Smart Team Contribution Monitoring",
    students: [
      ["Aditi Rao", "23CS001", "strong"],
      ["Bala Krishnan", "23CS002", "average"],
      ["Chitra Menon", "23CS003", "declining"],
      ["Dhruv Nair", "23CS004", "freerider"],
    ],
  },
  {
    name: "Team Beta",
    project: "Campus Navigation App",
    students: [
      ["Esha Verma", "23CS005", "strong"],
      ["Farhan Ali", "23CS006", "strong"],
      ["Gita Pillai", "23CS007", "average"],
      ["Harish Kumar", "23CS008", "declining"],
    ],
  },
  {
    name: "Team Gamma",
    project: "Library Management System",
    students: [
      ["Isha Menon", "23CS009", "average"],
      ["Jai Singh", "23CS010", "freerider"],
      ["Kavya Iyer", "23CS011", "improving"],
      ["Lakshmi Rao", "23CS012", "freerider"],
      ["Manoj Das", "23CS013", "average"],
    ],
  },
  {
    name: "Team Delta",
    project: "Weather Data Dashboard",
    students: [
      ["Nisha Joseph", "23CS014", "strong"],
      ["Omar Sheikh", "23CS015", "average"],
      ["Priya Nair", "23CS016", "strong"],
      ["Rahul Menon", "23CS017", "improving"],
    ],
  },
];

const PATTERNS = {
  strong: { docEdits: [4, 6], commits: [2, 4], messagesSent: [3, 5], repliesGiven: [1, 3], taskCompletion: 0.9 },
  improving: { docEdits: [3, 5], commits: [1, 3], messagesSent: [2, 4], repliesGiven: [1, 2], taskCompletion: 0.75 },
  average: { docEdits: [2, 4], commits: [1, 2], messagesSent: [1, 3], repliesGiven: [0, 2], taskCompletion: 0.6 },
  declining: { docEdits: [0, 2], commits: [0, 1], messagesSent: [0, 2], repliesGiven: [0, 1], taskCompletion: 0.4 },
  freerider: { docEdits: [0, 1], commits: [0, 0], messagesSent: [0, 1], repliesGiven: [0, 0], taskCompletion: 0.15 },
};

const TASK_TITLES = ["Requirements document", "Frontend dashboard UI", "Backend REST API", "Model training and testing"];
const DAY = 86400000;

function randInt([min, max]) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function levelFor(overallRisk) {
  if (overallRisk < 30) return { riskLevel: "LOW", decision: "ALLOW" };
  if (overallRisk <= 70) return { riskLevel: "MEDIUM", decision: "NUDGE" };
  return { riskLevel: "HIGH", decision: "ALERT" };
}

// Earlier weekly snapshots that lead up to the live prediction.
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

async function seedDatabase() {
  console.log("Clearing existing demo collections...");
  await Promise.all([
    User.deleteMany({}),
    Team.deleteMany({}),
    Task.deleteMany({}),
    Activity.deleteMany({}),
    Prediction.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash("password123", 10);

  const faculty = await User.create({
    name: "Dr. Vishnu Menon",
    email: "faculty@example.edu",
    passwordHash,
    role: "faculty",
  });

  const everyone = [];

  for (const spec of TEAMS) {
    const team = await Team.create({
      name: spec.name,
      projectTitle: spec.project,
      faculty: faculty._id,
      members: [],
    });

    const members = [];
    for (const [name, registerNo, pattern] of spec.students) {
      const doc = await User.create({
        name,
        email: `${registerNo.toLowerCase()}@example.edu`,
        passwordHash,
        role: "student",
        registerNo,
        team: team._id,
      });
      members.push({ doc, pattern, name });
    }
    team.members = members.map((m) => m.doc._id);
    await team.save();

    for (const m of members) {
      const p = PATTERNS[m.pattern];

      for (let i = 0; i < TASK_TITLES.length; i++) {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() - (TASK_TITLES.length - i) + 2);
        const done = Math.random() < p.taskCompletion;
        await Task.create({
          title: TASK_TITLES[i],
          team: team._id,
          assignedTo: m.doc._id,
          deadline,
          status: done ? "Completed" : i === TASK_TITLES.length - 1 ? "In Progress" : "Late",
          completedAt: done ? new Date(deadline.getTime() - DAY) : undefined,
        });
      }

      for (let d = 0; d < 7; d++) {
        if (m.pattern === "freerider" && Math.random() < 0.6) continue;
        if (m.pattern === "declining" && Math.random() < 0.3) continue;
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
      everyone.push({ ...m, team });
    }
  }

  console.log("Running agent pipeline for each student...");
  for (const s of everyone) {
    try {
      await runPipelineForStudent(s.doc._id, s.team._id);
      await seedHistory(s.doc, s.team, s.pattern);
    } catch (err) {
      console.warn(`Prediction failed for ${s.name}:`, err.message);
    }
  }

  console.log("\nSeed complete.");
  console.log("Faculty login:  faculty@example.edu / password123");
  console.log("Student logins: 23cs001@example.edu ... 23cs017@example.edu / password123");
  console.log("  23cs001 Aditi Rao (strong), 23cs004 Dhruv Nair (free rider)");

  return { faculty };
}

if (require.main === module) {
  require("dotenv").config();
  const MONGO_URI =
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/contribution_monitoring";

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
