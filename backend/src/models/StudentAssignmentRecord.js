const mongoose = require("mongoose");

// One row per student per assignment: the feature table for training and testing
// the academic risk model. Values are derived from submissions, activity, tasks
// and team data, and are rebuilt after every Classroom sync.
const recordSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true },
    assignmentType: { type: String, enum: ["individual", "contributed"], required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    attendance: Number,
    assignmentScore: Number,
    submissionStatus: { type: String, enum: ["submitted", "late", "missing"], required: true },
    lateSubmission: Boolean,
    commentsCount: Number,
    relevantComments: Number,
    tasksCompleted: Number,
    projectInteractions: Number,
    activityScore: Number,
    contributionScore: Number,
  },
  { timestamps: true }
);

recordSchema.index({ student: 1, assignment: 1 }, { unique: true });

module.exports = mongoose.model("StudentAssignmentRecord", recordSchema);
