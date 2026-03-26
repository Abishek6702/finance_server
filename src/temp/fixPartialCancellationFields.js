require("dotenv").config();

const { connectDB, disconnectDB } = require("../config/db");
const StudentFeeTracking = require("../api/fee-payment/student-fee-tracking/modelStudentFeeTracking");

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const ROLL_NO = [...args].find((arg) => arg.startsWith("--rollNo="))?.split("=")[1]?.toUpperCase();

const normalizeMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
};

const isInactiveLedger = (ledger) => {
  if (!ledger) return false;
  return ledger.isActive === false || Boolean(ledger.endDate);
};

async function run() {
  await connectDB();

  const query = ROLL_NO ? { rollNo: ROLL_NO } : {};
  const docs = await StudentFeeTracking.collection.find(query).toArray();

  let touchedDocs = 0;
  let touchedYears = 0;
  let touchedLedgers = 0;

  for (const tracking of docs) {
    let docChanged = false;
    const updatedYearRecords = (tracking.academicYearWiseRecord || []).map((yearRecord) => {
      let yearChanged = false;

      const normalizeLedger = (ledger) => {
        if (!ledger) return ledger;

        const updatedLedger = { ...ledger };
        let changed = false;

        if (updatedLedger.consumedAmount === undefined) {
          if (updatedLedger.consumedAmountOnPartialCancellation !== undefined) {
            updatedLedger.consumedAmount = normalizeMoney(updatedLedger.consumedAmountOnPartialCancellation || 0);
            changed = true;
          }
        } else {
          const normalized = normalizeMoney(updatedLedger.consumedAmount || 0);
          if (normalized !== updatedLedger.consumedAmount) {
            updatedLedger.consumedAmount = normalized;
            changed = true;
          }
        }

        if (updatedLedger.consumedAmountOnPartialCancellation !== undefined) {
          delete updatedLedger.consumedAmountOnPartialCancellation;
          changed = true;
        }

        if (updatedLedger.conceptionOnPartialCancellation !== undefined) {
          delete updatedLedger.conceptionOnPartialCancellation;
          changed = true;
        }

        if (isInactiveLedger(updatedLedger) && updatedLedger.total) {
          const updatedTotal = { ...updatedLedger.total };
          if (updatedTotal.status !== "Refunded") {
            updatedTotal.status = "Refunded";
            changed = true;
          }
          if (normalizeMoney(updatedTotal.paid || 0) !== 0) {
            updatedTotal.paid = 0;
            changed = true;
          }
          updatedLedger.total = updatedTotal;
        }

        if (changed) {
          yearChanged = true;
          touchedLedgers += 1;
        }

        return updatedLedger;
      };

      const updatedTransport = normalizeLedger(yearRecord.transport);
      const updatedHostel = normalizeLedger(yearRecord.hostel);

      if (!yearChanged) return yearRecord;
      touchedYears += 1;
      docChanged = true;

      return {
        ...yearRecord,
        transport: updatedTransport,
        hostel: updatedHostel,
      };
    });

    if (docChanged) {
      touchedDocs += 1;
      if (APPLY) {
        await StudentFeeTracking.collection.updateOne(
          { _id: tracking._id },
          { $set: { academicYearWiseRecord: updatedYearRecords } }
        );
      }
    }
  }

  const mode = APPLY ? "APPLY" : "DRY-RUN";
  console.log("----------------------------------------");
  console.log(`[${mode}] Partial cancellation repair summary`);
  console.log(`Documents scanned : ${docs.length}`);
  console.log(`Documents touched : ${touchedDocs}`);
  console.log(`Year records fixed: ${touchedYears}`);
  console.log(`Ledgers fixed     : ${touchedLedgers}`);
  console.log("----------------------------------------");

  if (!APPLY) {
    console.log("No DB writes performed. Re-run with --apply to persist changes.");
  }
}

run()
  .catch((error) => {
    console.error("Failed to repair partial cancellation fields:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
