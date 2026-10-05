const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["Not Started", "In Progress", "Completed", "Late"],
      default: "Not Started",
    },
    deadline: { type: Date, required: true },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
