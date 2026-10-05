const mongoose = require("mongoose");

// One student's submission to an individual assignment.
const submissionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    submitted: { type: Boolean, default: false },
    submittedAt: Date,
    late: { type: Boolean, default: false },
    score: Number,
    attempts: { type: Number, default: 0 },
    feedback: String,
    comments: [String],
  },
  { timestamps: true }
);

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("Submission", submissionSchema);
