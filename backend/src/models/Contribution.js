const mongoose = require("mongoose");

// Signals for one student on one team assignment. These come from git, the
// documents tool and rating forms, not from Google Classroom.
const contributionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    commits: { type: Number, default: 0 },
    pullRequests: { type: Number, default: 0 },
    filesModified: { type: Number, default: 0 },
    docPages: { type: Number, default: 0 },
    peerRating: { type: Number, min: 0, max: 5 },
    facultyRating: { type: Number, min: 0, max: 5 },
  },
  { timestamps: true }
);

contributionSchema.index({ assignment: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("Contribution", contributionSchema);
