/**
 * Seeds demo data: 1 faculty, 4 teams, 17 students with different behaviour
 * patterns, academic profiles, 4 assignments (2 individual, 2 team), tasks and
 * git, document and rating signals for the team assignments, 7 days of activity,
 * a live pipeline run per student, and 5 weeks of earlier prediction snapshots.
 *
 * Assignments exist but stay hidden until the faculty member syncs Google
 * Classroom (simulated), which imports submissions and scores.
 * Weekly snapshots and signals are generated demo data.
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
const Assignment = require("../src/models/Assignment");
const Submission = require("../src/models/Submission");
const Contribution = require("../src/models/Contribution");
const { runPipelineForStudent } = require("../src/agents/orchestrator");
const { courseworkFor } = require("../src/services/classroom");

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
  strong: { docEdits: [4, 6], commits: [2, 4], messagesSent: [3, 5], repliesGiven: [1, 3], taskCompletion: 0.9,
    academic: { att: [90, 98], marks: [75, 92], gpa: [8.2, 9.4] }, signals: { commits: [22, 36], prs: [4, 8], files: [14, 26], docs: [3, 6], peer: [4.2, 4.9], faculty: [4.1, 4.9] } },
  improving: { docEdits: [3, 5], commits: [1, 3], messagesSent: [2, 4], repliesGiven: [1, 2], taskCompletion: 0.75,
    academic: { att: [80, 90], marks: [65, 80], gpa: [7.4, 8.4] }, signals: { commits: [14, 24], prs: [3, 6], files: [9, 18], docs: [2, 5], peer: [3.7, 4.4], faculty: [3.6, 4.4] } },
  average: { docEdits: [2, 4], commits: [1, 2], messagesSent: [1, 3], repliesGiven: [0, 2], taskCompletion: 0.6,
    academic: { att: [75, 88], marks: [55, 72], gpa: [6.8, 7.8] }, signals: { commits: [10, 18], prs: [2, 4], files: [6, 13], docs: [1, 3], peer: [3.2, 4.0], faculty: [3.2, 4.0] } },
  declining: { docEdits: [0, 2], commits: [0, 1], messagesSent: [0, 2], repliesGiven: [0, 1], taskCompletion: 0.4,
    academic: { att: [62, 78], marks: [42, 60], gpa: [6.0, 7.2] }, signals: { commits: [5, 10], prs: [1, 2], files: [3, 8], docs: [0, 2], peer: [2.6, 3.4], faculty: [2.6, 3.4] } },
  freerider: { docEdits: [0, 1], commits: [0, 0], messagesSent: [0, 1], repliesGiven: [0, 0], taskCompletion: 0.15,
    academic: { att: [50, 70], marks: [30, 52], gpa: [5.0, 6.4] }, signals: { commits: [0, 4], prs: [0, 1], files: [0, 3], docs: [0, 1], peer: [1.5, 2.6], faculty: [1.5, 2.6] } },
};

// Task titles by assignment, one list per member slot in a team.
const TASK_POOLS = {
  "cw-2": [
    ["Backend API", "Authentication", "Product API", "Order API"],
    ["Frontend shell", "Product pages", "Cart and checkout", "Responsive layout"],
    ["Schema design", "Seed data", "Query optimisation"],
    ["Requirements document", "User manual", "Test report"],
    ["Unit tests", "Integration tests", "Bug triage"],
  ],
  "cw-4": [
    ["Screen designs", "Navigation flow", "Form validation"],
    ["API client", "State management", "Offline cache"],
    ["Backend endpoints", "Push notifications", "Auth tokens"],
    ["User guide", "Demo script", "Test plan"],
    ["Device testing", "Performance checks", "Accessibility review"],
  ],
};

const DAY = 86400000;

function randInt([min, max]) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat([min, max]) {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function levelFor(overallRisk) {
  if (overallRisk < 30) return { riskLevel: "LOW", decision: "ALLOW" };
  if (overallRisk <= 70) return { riskLevel: "MEDIUM", decision: "NUDGE" };
  return { riskLevel: "HIGH", decision: "ALERT" };
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

async function seedDatabase() {
  console.log("Clearing existing demo collections...");
  await Promise.all(
    [User, Team, Task, Activity, Prediction, Assignment, Submission, Contribution].map((m) => m.deleteMany({}))
  );

  const passwordHash = await bcrypt.hash("password123", 10);

  const faculty = await User.create({
    name: "Dr. Vishnu Menon",
    email: "faculty@example.edu",
    passwordHash,
    role: "faculty",
  });

  const teams = [];
  const everyone = [];

  for (const spec of TEAMS) {
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
    teams.push({ team, members });
    members.forEach((m) => everyone.push({ ...m, team }));
  }

  // Assignments exist from the start but stay hidden until a Classroom sync.
  const assignments = {};
  for (const cw of courseworkFor("cs301")) {
    assignments[cw.externalId] = await Assignment.create({
      faculty: faculty._id,
      course: { id: "cs301", name: "CS301 Full Stack Web Development" },
      externalId: cw.externalId,
      title: cw.title,
      description: cw.description,
      type: cw.type,
      assignedDate: cw.assignedDate,
      dueDate: cw.dueDate,
      maxScore: cw.maxScore,
      // Mobile App Prototype starts with two teams. The rest of the class forms its own.
      teams: cw.type !== "team" ? [] : (cw.externalId === "cw-4" ? teams.slice(0, 2) : teams).map((t) => t.team._id),
    });
  }

  for (const { team, members } of teams) {
    for (const [slot, m] of members.entries()) {
      const p = PATTERNS[m.pattern];

      for (const cwId of ["cw-2", "cw-4"]) {
        const assignment = assignments[cwId];
        if (!assignment.teams.some((t) => String(t) === String(team._id))) continue;
        const pastDue = assignment.dueDate.getTime() < Date.now();
        const pool = TASK_POOLS[cwId][slot % TASK_POOLS[cwId].length];
        for (const title of pool) {
          let status;
          let completedAt;
          if (pastDue) {
            const done = Math.random() < p.taskCompletion;
            status = done ? "Completed" : "Late";
            completedAt = done ? new Date(assignment.dueDate.getTime() - DAY * (1 + Math.random() * 4)) : undefined;
          } else {
            const done = Math.random() < p.taskCompletion * 0.45;
            status = done ? "Completed" : Math.random() < 0.55 ? "In Progress" : "Not Started";
            completedAt = done ? new Date() : undefined;
          }
          await Task.create({ title, team: team._id, assignment: assignment._id, assignedTo: m.doc._id, deadline: assignment.dueDate, status, completedAt });
        }

        const scale = pastDue ? 1 : 0.45;
        const s = p.signals;
        await Contribution.create({
          assignment: assignment._id,
          team: team._id,
          student: m.doc._id,
          commits: Math.round(randInt(s.commits) * scale),
          pullRequests: Math.round(randInt(s.prs) * scale),
          filesModified: Math.round(randInt(s.files) * scale),
          docPages: Math.round(randInt(s.docs) * scale),
          peerRating: randFloat(s.peer),
          facultyRating: pastDue ? randFloat(s.faculty) : undefined,
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
