const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/students");
const taskRoutes = require("./routes/tasks");
const facultyRoutes = require("./routes/faculty");
const classroomRoutes = require("./routes/classroom");
const assignmentRoutes = require("./routes/assignments");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/classroom", classroomRoutes);
app.use("/api/assignments", assignmentRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
