const mongoose = require("mongoose");

// Coursework imported from the LMS (Google Classroom, or the simulated provider).
const assignmentSchema = new mongoose.Schema(
  {
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { id: String, name: String },
    externalId: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    type: { type: String, enum: ["individual", "team"], required: true },
    assignedDate: Date,
    dueDate: Date,
    maxScore: { type: Number, default: 100 },
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: "Team" }],
    teamSubmissions: [
      {
        team: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
        submitted: Boolean,
        submittedAt: Date,
        late: Boolean,
        score: Number,
        feedback: String,
      },
    ],
    syncedAt: Date,
  },
  { timestamps: true }
);

assignmentSchema.index({ faculty: 1, externalId: 1 }, { unique: true });

module.exports = mongoose.model("Assignment", assignmentSchema);
