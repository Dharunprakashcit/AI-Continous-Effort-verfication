const mongoose = require("mongoose");

// One document per student per day - the raw signal the agents read.
const activitySchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    date: { type: Date, required: true },
    docEdits: { type: Number, default: 0 },
    commits: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    repliesGiven: { type: Number, default: 0 },
    activeMinutes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

activitySchema.index({ student: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Activity", activitySchema);
