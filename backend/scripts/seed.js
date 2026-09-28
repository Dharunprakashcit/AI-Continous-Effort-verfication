/**
 * Seeds demo data: 1 faculty, 1 team of 4 students, tasks, and 7 days
 * of activity logs with deliberately different patterns per student
 * (strong contributor -> free-rider) so the dashboards have something
 * meaningful to show immediately after seeding.
 *
 * Exports seedDatabase() so both the standalone CLI (`npm run seed`)
 * and the zero-setup demo runner (`npm run demo`) can reuse it against
 * an already-connected mongoose instance.
 */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../src/models/User");
const Team = require("../src/models/Team");
const Task = require("../src/models/Task");
const Activity = require("../src/models/Activity");
const Prediction = require("../src/models/Prediction");
const { runPipelineForStudent } = require("../src/agents/orchestrator");

const STUDENT_PROFILES = [
  { name: "Aditi Rao", registerNo: "23CS001", pattern: "strong" },
  { name: "Bala Krishnan", registerNo: "23CS002", pattern: "average" },
  { name: "Chitra Menon", registerNo: "23CS003", pattern: "declining" },
  { name: "Dhruv Nair", registerNo: "23CS004", pattern: "freerider" },
];

const PATTERNS = {
  strong: { docEdits: [4, 6], commits: [2, 4], messagesSent: [3, 5], repliesGiven: [1, 3], taskCompletion: 0.9 },
  average: { docEdits: [2, 4], commits: [1, 2], messagesSent: [1, 3], repliesGiven: [0, 2], taskCompletion: 0.6 },
  declining: { docEdits: [0, 2], commits: [0, 1], messagesSent: [0, 2], repliesGiven: [0, 1], taskCompletion: 0.4 },
  freerider: { docEdits: [0, 1], commits: [0, 0], messagesSent: [0, 1], repliesGiven: [0, 0], taskCompletion: 0.15 },
};

function randInt([min, max]) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

  const team = await Team.create({
    name: "Team Alpha",
    projectTitle: "Smart Team Contribution Monitoring System",
    faculty: faculty._id,
    members: [],
  });

  const students = [];
  for (const profile of STUDENT_PROFILES) {
    const student = await User.create({
      name: profile.name,
      email: `${profile.registerNo.toLowerCase()}@example.edu`,
      passwordHash,
      role: "student",
      registerNo: profile.registerNo,
      team: team._id,
    });
    students.push({ ...profile, doc: student });
  }

  team.members = students.map((s) => s.doc._id);
  await team.save();

  const taskTitles = [
    "Requirements document",
    "Frontend dashboard UI",
    "Backend REST API",
    "ANN model training",
  ];

  for (const s of students) {
    const pattern = PATTERNS[s.pattern];
    const numTasks = 4;
    for (let i = 0; i < numTasks; i++) {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() - (numTasks - i) + 2);
      const willComplete = Math.random() < pattern.taskCompletion;
      await Task.create({
        title: taskTitles[i],
        team: team._id,
        assignedTo: s.doc._id,
        deadline,
        status: willComplete ? "Completed" : i === numTasks - 1 ? "In Progress" : "Late",
        completedAt: willComplete ? new Date(deadline.getTime() - 86400000) : undefined,
      });
    }

    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - d);

      // Skip some days entirely for lower-activity patterns.
      if (s.pattern === "freerider" && Math.random() < 0.6) continue;
      if (s.pattern === "declining" && Math.random() < 0.3) continue;

      await Activity.create({
        student: s.doc._id,
        team: team._id,
        date,
        docEdits: randInt(pattern.docEdits),
        commits: randInt(pattern.commits),
        messagesSent: randInt(pattern.messagesSent),
        repliesGiven: randInt(pattern.repliesGiven),
        activeMinutes: randInt([10, 90]),
      });
    }
  }

  console.log("Running agent pipeline for each student...");
  for (const s of students) {
    try {
      await runPipelineForStudent(s.doc._id, team._id);
    } catch (err) {
      console.warn(`Prediction failed for ${s.name} (ANN service may be offline):`, err.message);
    }
  }

  console.log("\nSeed complete.");
  console.log("Faculty login:  faculty@example.edu / password123");
  console.log("Student logins:");
  for (const s of students) {
    console.log(`  ${s.name.padEnd(16)} ${s.doc.email} / password123  (${s.pattern})`);
  }

  return { faculty, team, students };
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
