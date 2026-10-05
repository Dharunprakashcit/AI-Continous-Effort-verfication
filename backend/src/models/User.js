const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student", "faculty"], required: true },
    registerNo: { type: String },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    attendancePct: Number,
    internalMarks: Number,
    previousGpa: Number,
    classroomConnectedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
