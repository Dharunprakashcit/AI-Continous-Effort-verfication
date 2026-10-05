const Team = require("../models/Team");
const User = require("../models/User");
const Assignment = require("../models/Assignment");
const { buildAssignmentRecords } = require("./records");

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Students of the assignment's faculty who are not yet on a team for this assignment.
async function availableStudents(assignment) {
  const base = await Team.find({ faculty: assignment.faculty, assignment: null })
    .populate("members", "name registerNo")
    .lean();
  const formed = await Team.find({ _id: { $in: assignment.teams } }).lean();
  const taken = new Set(formed.flatMap((t) => t.members.map(String)));
  return base.flatMap((t) => t.members).filter((s) => !taken.has(String(s._id)));
}

// Creates a team inside one team assignment. Contribution is never entered here.
async function createTeam(assignment, { name, memberIds }) {
  if (assignment.type !== "team") throw fail(400, "Teams can only be created for team assignments.");

  const cleanName = String(name || "").trim();
  if (!cleanName || cleanName.length > 40) throw fail(400, "Enter a team name of up to 40 characters.");

  const ids = [...new Set((memberIds || []).map(String))];
  if (ids.length < 2) throw fail(400, "Choose at least two members.");
  if (ids.length > 8) throw fail(400, "A team can have at most 8 members.");

  const existing = await Team.find({ _id: { $in: assignment.teams } }).lean();
  if (existing.some((t) => t.name.toLowerCase() === cleanName.toLowerCase())) {
    throw fail(400, "A team with this name already exists for this assignment.");
  }

  const free = new Set((await availableStudents(assignment)).map((s) => String(s._id)));
  if (ids.some((id) => !free.has(id))) throw fail(400, "Some of the chosen students are not available.");

  const team = await Team.create({
    name: cleanName,
    projectTitle: assignment.title,
    faculty: assignment.faculty,
    assignment: assignment._id,
    members: ids,
  });
  await Assignment.updateOne({ _id: assignment._id }, { $push: { teams: team._id } });
  await buildAssignmentRecords(await Assignment.findById(assignment._id).lean());
  return team;
}

async function studentFaculty(studentId) {
  const me = await User.findById(studentId).lean();
  const home = me?.team ? await Team.findById(me.team).lean() : null;
  return { me, facultyId: home?.faculty };
}

module.exports = { availableStudents, createTeam, studentFaculty };
