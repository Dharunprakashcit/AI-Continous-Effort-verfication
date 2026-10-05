/**
 * Builds a large student-assignment dataset for training the academic risk model.
 * It seeds an in-memory database with many teams, runs the simulated Classroom sync,
 * and writes the feature table to a CSV. No MongoDB install is needed.
 *
 *   node scripts/generate-dataset.js [extraTeams] [outputPath]
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { seedDatabase } = require("./seed");
const { syncCourse } = require("../src/services/classroom");
const { recordsToCsv } = require("../src/services/records");

async function main() {
  const extraTeams = Number(process.argv[2] || 60);
  const out = process.argv[3] || path.join(__dirname, "..", "..", "ann-service", "data", "student_assignment_records.csv");

  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const { faculty } = await seedDatabase({ extraTeams, runPipeline: false });
  const result = await syncCourse(faculty._id, "aml");
  const csv = await recordsToCsv(faculty._id);

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, csv);
  console.log(`\nWrote ${result.records} rows to ${out}`);

  await mongoose.disconnect();
  await mongod.stop();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
