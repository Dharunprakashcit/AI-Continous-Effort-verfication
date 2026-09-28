/**
 * Zero-setup demo runner: spins up an ephemeral in-memory MongoDB
 * (no local `mongod` or Docker required), seeds it, and starts the API
 * in the same process. Intended for quickly demoing/grading the
 * prototype; use the real `npm run dev` + a persistent MongoDB for
 * anything long-lived, since all data is lost when this process exits.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../src/app");
const { seedDatabase } = require("./seed");

const PORT = process.env.PORT || 5000;

async function main() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  await mongoose.connect(uri);
  console.log(`In-memory MongoDB started at ${uri}`);

  await seedDatabase();

  const server = app.listen(PORT, () =>
    console.log(`\nDemo API listening on http://localhost:${PORT} (in-memory DB, ANN_SERVICE_URL=${process.env.ANN_SERVICE_URL || "http://127.0.0.1:5001"})`)
  );

  async function shutdown() {
    console.log("\nShutting down demo server...");
    server.close();
    await mongoose.disconnect();
    await mongod.stop();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
