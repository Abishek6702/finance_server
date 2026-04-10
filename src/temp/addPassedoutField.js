require("dotenv").config();

const { connectDB, disconnectDB } = require("../config/db");
const Student = require("../api/student/students-management/modelStudent");

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const REMOVE = args.has("--remove");

async function run() {
  await connectDB();

  const filter = REMOVE ? { passedout: { $exists: true } } : { passedout: { $exists: false } };
  const update = REMOVE ? { $unset: { passedout: "" } } : { $set: { passedout: false } };

  const count = await Student.countDocuments(filter);

  if (count === 0) {
    console.log("No student documents require changes.");
    return;
  }

  console.log(`Students matched: ${count}`);

  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to write changes.");
    return;
  }

  const result = await Student.updateMany(filter, update);
  console.log(`Students modified: ${result.modifiedCount}`);
}

run()
  .catch((error) => {
    console.error("Failed to update passedout field:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
