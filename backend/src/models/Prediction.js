const mongoose = require("mongoose");

// Snapshot of one orchestrator run for a student: each agent's sub-score,
// the ANN's risk probability, the fused risk, and the decision agent's
// verdict. Kept as an immutable history so faculty can see trends and
// leave feedback used for future model/system improvement.
const predictionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },

    editScore: { type: Number, required: true },
    taskScore: { type: Number, required: true },
    communicationScore: { type: Number, required: true },
    annRiskProbability: { type: Number, required: true },

    overallRisk: { type: Number, required: true }, // 0-100, higher = more at risk
    contributionScore: { type: Number, required: true }, // 0-100, higher = better
    riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], required: true },

    decision: { type: String, enum: ["ALLOW", "NUDGE", "ALERT"], required: true },
    explanations: [{ type: String }],
    recommendation: { type: String },

    featuresUsed: { type: mongoose.Schema.Types.Mixed },

    facultyFeedback: {
      reviewed: { type: Boolean, default: false },
      correct: { type: Boolean },
      comment: { type: String },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reviewedAt: { type: Date },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Prediction", predictionSchema);
