const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    projectTitle: { type: String },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Set for teams created inside one team assignment. Project teams have none.
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Team", teamSchema);
