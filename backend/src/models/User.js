const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student", "faculty"], required: true },
    registerNo: { type: String },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
