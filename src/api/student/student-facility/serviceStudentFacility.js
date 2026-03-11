const Student = require("../students-management/modelStudent");
const { Transport } = require("../../fee-structure/transport/modelTransport");
const { Hostel } = require("../../fee-structure/hostel/modelHostel");
const StudentFeeTracking = require("../../fee-payment/student-fee-tracking/modelStudentFeeTracking");
const AppError = require("../../../utils/appError");

function normalizeMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
}

function buildTargetYears(applyFromAcademicYear, batchEndYear) {
  const startYear = parseInt(applyFromAcademicYear.split("-")[0], 10);
  const years = [];
  for (let y = startYear; y < batchEndYear; y++) {
    years.push(`${y}-${y + 1}`);
  }
  return years;
}

const updateFacility = async (rollNo, { transport, hostel, applyFromAcademicYear }) => {
  /* ─── Phase 1: Fetch student ─── */
  const student = await Student.findOne({ "personal.rollNo": rollNo.toUpperCase() });
  if (!student) throw new AppError("Student not found", 404);

  /* ─── Phase 2: Validate applyFromAcademicYear range ─── */
  const applyFromStart = parseInt(applyFromAcademicYear.split("-")[0], 10);
  const currentYearStart = parseInt(student.academic.currentAcademicYear.split("-")[0], 10);
  const batchEndYear = parseInt(student.academic.batch.split("-")[1], 10);

  if (applyFromStart < currentYearStart) {
    throw new AppError(
      `applyFromAcademicYear cannot be before the student's current academic year (${student.academic.currentAcademicYear})`,
      400
    );
  }

  if (applyFromStart >= batchEndYear) {
    throw new AppError(
      `applyFromAcademicYear must be within the student's batch range (batch: ${student.academic.batch})`,
      400
    );
  }

  /* ─── Phase 3: Resolve transport & hostel master docs ─── */
  let resolvedTransport = null;
  if (transport !== undefined && transport.isApplicable) {
    const transportDoc = await Transport.findOne({
      route: transport.route,
      stop: transport.stopName,
    });
    if (!transportDoc) {
      throw new AppError(
        `Transport not found for route "${transport.route}" and stop "${transport.stopName}"`,
        404
      );
    }
    resolvedTransport = {
      isApplicable: true,
      transport: transportDoc.id,
      route: transportDoc.route,
      busNo: transportDoc.busNo,
      stop: transportDoc.stop,
      fee: transportDoc.fee,
    };
  }

  let resolvedHostel = null;
  if (hostel !== undefined && hostel.isApplicable) {
    const hostelDoc = await Hostel.findOne({
      block: String(hostel.block).toUpperCase(),
      sharing: hostel.sharing,
      isAttached: hostel.isAttached,
    });
    if (!hostelDoc) {
      throw new AppError(
        `Hostel not found for block "${hostel.block}", sharing ${hostel.sharing}, isAttached ${hostel.isAttached}`,
        404
      );
    }
    resolvedHostel = {
      isApplicable: true,
      hostel: hostelDoc.id,
      block: hostelDoc.block,
      sharing: hostelDoc.sharing,
      isAttached: hostelDoc.isAttached,
      fee: hostelDoc.fee,
    };
  }

  /* ─── Phase 4: Paid/Partial guard (applyFromAcademicYear only) ─── */
  const tracking = await StudentFeeTracking.findOne({ rollNo: rollNo.toUpperCase() });

  if (tracking) {
    const applyFromRecord = tracking.academicYearWiseRecord.find(
      (r) => r.academicYear === applyFromAcademicYear
    );

    if (applyFromRecord) {
      const isBlockedStatus = (status) =>
        status === "Paid" || status === "Partial";

      if (transport !== undefined) {
        const tStatus = applyFromRecord.transport?.total?.status;
        if (isBlockedStatus(tStatus)) {
          throw new AppError(
            `Cannot change transport: transport fee for ${applyFromAcademicYear} is already ${tStatus}`,
            409
          );
        }
      }

      if (hostel !== undefined) {
        const hStatus = applyFromRecord.hostel?.total?.status;
        if (isBlockedStatus(hStatus)) {
          throw new AppError(
            `Cannot change hostel: hostel fee for ${applyFromAcademicYear} is already ${hStatus}`,
            409
          );
        }
      }
    }
  }

  /* ─── Phase 5: Build target year range ─── */
  const targetYears = buildTargetYears(applyFromAcademicYear, batchEndYear);

  /* ─── Phase 6: Update StudentFeeTracking year records ─── */
  let trackingTouched = false;

  if (tracking) {
    for (const yearRecord of tracking.academicYearWiseRecord) {
      if (!targetYears.includes(yearRecord.academicYear)) continue;

      if (transport !== undefined) {
        if (!transport.isApplicable) {
          yearRecord.transport = null;
        } else {
          yearRecord.transport = {
            transport: resolvedTransport.transport,
            route: resolvedTransport.route,
            busNo: resolvedTransport.busNo,
            stop: resolvedTransport.stop,
            fee: resolvedTransport.fee,
            subTotal: normalizeMoney(resolvedTransport.fee),
            total: { total: 0 },
          };
        }
        trackingTouched = true;
      }

      if (hostel !== undefined) {
        if (!hostel.isApplicable) {
          yearRecord.hostel = null;
        } else {
          yearRecord.hostel = {
            hostel: resolvedHostel.hostel,
            block: resolvedHostel.block,
            sharing: resolvedHostel.sharing,
            isAttached: resolvedHostel.isAttached,
            fee: resolvedHostel.fee,
            subTotal: normalizeMoney(resolvedHostel.fee),
            hostelSpecialConcession: 0,
            total: { total: 0 },
          };
        }
        trackingTouched = true;
      }
    }

    if (trackingTouched) {
      tracking.markModified("academicYearWiseRecord");
      await tracking.save();
    }
  }

  /* ─── Phase 7: Update Student document ─── */
  if (transport !== undefined) {
    student.transport = transport.isApplicable
      ? resolvedTransport
      : { isApplicable: false };
  }

  if (hostel !== undefined) {
    student.hostel = hostel.isApplicable
      ? resolvedHostel
      : { isApplicable: false };
  }

  await student.save();

  const message = trackingTouched
    ? "Facility updated successfully"
    : "Student profile updated; no matching fee tracking records found for the target year range";

  return { student, message };
};

module.exports = { updateFacility };
