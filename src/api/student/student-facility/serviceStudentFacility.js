const Student = require("../students-management/modelStudent");
const { Transport } = require("../../fee-structure/transport/modelTransport");
const { Hostel } = require("../../fee-structure/hostel/modelHostel");
const StudentFeeTracking = require("../../fee-payment/student-fee-tracking/modelStudentFeeTracking");
const refundService = require("../../fee-payment/refund/service.refund");
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

const updateFacility = async (rollNo, { transport, hostel, applyFromAcademicYear, effectiveDate }) => {
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
  const resolvedEffectiveDate = effectiveDate ? new Date(effectiveDate) : new Date();

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
      effectiveDate: resolvedEffectiveDate,
      endDate: null,
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
      effectiveDate: resolvedEffectiveDate,
      endDate: null,
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
          if (yearRecord.transport) {
            yearRecord.transport.isActive = false;
            yearRecord.transport.endDate = yearRecord.transport.endDate || new Date();
          }
        } else {
          yearRecord.transport = {
            transport: resolvedTransport.transport,
            route: resolvedTransport.route,
            busNo: resolvedTransport.busNo,
            stop: resolvedTransport.stop,
            fee: resolvedTransport.fee,
            subTotal: normalizeMoney(resolvedTransport.fee),
            consumedAmountOnPartialCancellation: 0,
            conceptionOnPartialCancellation: 0,
            isActive: true,
            effectiveDate: resolvedTransport.effectiveDate,
            endDate: null,
            total: { total: 0 },
          };
        }
        trackingTouched = true;
      }

      if (hostel !== undefined) {
        if (!hostel.isApplicable) {
          if (yearRecord.hostel) {
            yearRecord.hostel.isActive = false;
            yearRecord.hostel.endDate = yearRecord.hostel.endDate || new Date();
          }
        } else {
          yearRecord.hostel = {
            hostel: resolvedHostel.hostel,
            block: resolvedHostel.block,
            sharing: resolvedHostel.sharing,
            isAttached: resolvedHostel.isAttached,
            fee: resolvedHostel.fee,
            subTotal: normalizeMoney(resolvedHostel.fee),
            hostelSpecialConcession: 0,
            consumedAmountOnPartialCancellation: 0,
            conceptionOnPartialCancellation: 0,
            isActive: true,
            effectiveDate: resolvedHostel.effectiveDate,
            endDate: null,
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
      : {
          ...(student.transport?.toObject ? student.transport.toObject() : student.transport),
          isApplicable: false,
          endDate: new Date(),
        };
  }

  if (hostel !== undefined) {
    student.hostel = hostel.isApplicable
      ? resolvedHostel
      : {
          ...(student.hostel?.toObject ? student.hostel.toObject() : student.hostel),
          isApplicable: false,
          endDate: new Date(),
        };
  }

  await student.save();

  const message = trackingTouched
    ? "Facility updated successfully"
    : "Student profile updated; no matching fee tracking records found for the target year range";

  return { student, message };
};

exports.removeFacility = async (rollNo, payload, userId) => {
  const { facilityType, applyFromAcademicYear, endDate, conceptionAmount, refundMode, refundAmount, idempotencyKey } = payload;

  const normalizedRollNo = rollNo.toUpperCase();

  const student = await Student.findOne({ "personal.rollNo": normalizedRollNo });
  if (!student) throw new AppError("Student not found", 404);

  const tracking = await StudentFeeTracking.findOne({ rollNo: normalizedRollNo });
  if (!tracking) throw new AppError("Fee tracking record not found", 404);

  const yearRecord = tracking.academicYearWiseRecord.find(
    (record) => record.academicYear === applyFromAcademicYear
  );

  if (!yearRecord) {
    throw new AppError(`Academic year ${applyFromAcademicYear} not found in tracking`, 404);
  }

  const ledger = facilityType === 'transport' ? yearRecord.transport : yearRecord.hostel;

  if (!ledger) {
    throw new AppError(`${facilityType} ledger not found for the academic year`, 404);
  }

  if (ledger.isActive === false || ledger.endDate) {
    throw new AppError("Facility is already inactive or endDate is already set", 400);
  }

  const normalizedConsumedAmount = normalizeMoney(conceptionAmount || 0);
  const currentPaid = normalizeMoney(ledger.total?.paid || 0);
  const currentNetTotal = normalizeMoney(ledger.total?.total || 0);

  if (currentPaid <= 0) {
    throw new AppError(`No paid amount available to settle ${facilityType} cancellation`, 400);
  }

  if (normalizedConsumedAmount > currentPaid) {
    throw new AppError(
      `consumed amount ₹${normalizedConsumedAmount} cannot exceed paid amount ₹${currentPaid}`,
      400
    );
  }

  const computedRefundAmount = normalizeMoney(Math.max(0, currentPaid - normalizedConsumedAmount));

  if (
    refundAmount !== undefined &&
    Math.abs(normalizeMoney(refundAmount) - computedRefundAmount) > 0.01
  ) {
    throw new AppError(
      `refundAmount mismatch. Expected ₹${computedRefundAmount} based on paid minus consumed amount`,
      400
    );
  }

  let refundRecord = null;

  if (computedRefundAmount > 0) {
    refundRecord = await refundService.createRefund(
      {
        rollNo: normalizedRollNo,
        academicYear: applyFromAcademicYear,
        feeHead: facilityType,
        refundAmount: computedRefundAmount,
        reason: `Facility removed via ${refundMode}`,
        isActive: false,
        idempotencyKey,
      },
      userId
    );
  }

  const refreshedTracking = await StudentFeeTracking.findOne({ rollNo: normalizedRollNo });
  if (!refreshedTracking) throw new AppError("Fee tracking record not found after refund processing", 404);

  const refreshedYear = refreshedTracking.academicYearWiseRecord.find(
    (record) => record.academicYear === applyFromAcademicYear
  );
  if (!refreshedYear) throw new AppError(`Academic year ${applyFromAcademicYear} not found in tracking`, 404);

  const refreshedLedger = facilityType === 'transport' ? refreshedYear.transport : refreshedYear.hostel;
  if (!refreshedLedger) throw new AppError(`${facilityType} ledger not found for the academic year`, 404);

  const cancellationConcession = normalizeMoney(Math.max(0, currentNetTotal - normalizedConsumedAmount));

  refreshedLedger.consumedAmountOnPartialCancellation = normalizedConsumedAmount;
  refreshedLedger.conceptionOnPartialCancellation = cancellationConcession;
  refreshedLedger.total.paid = normalizedConsumedAmount;
  refreshedLedger.isActive = false;
  refreshedLedger.endDate = new Date(endDate);

  refreshedTracking.markModified("academicYearWiseRecord");
  await refreshedTracking.save();

  if (refundMode === 'wallet' && computedRefundAmount > 0) {
    student.enrollment.excessAmount = normalizeMoney(
      (student.enrollment?.excessAmount || 0) + computedRefundAmount
    );
    student.enrollment.isExcessAmountTrue = student.enrollment.excessAmount > 0;
  }

  // Update Student state
  if (facilityType === 'transport') {
    student.transport = {
      ...(student.transport?.toObject ? student.transport.toObject() : student.transport),
      isApplicable: false,
      endDate: new Date(endDate),
    };
  } else if (facilityType === 'hostel') {
    student.hostel = {
      ...(student.hostel?.toObject ? student.hostel.toObject() : student.hostel),
      isApplicable: false,
      endDate: new Date(endDate),
    };
  }

  await student.save();

  return {
    student,
    tracking: refreshedTracking,
    settlement: {
      facilityType,
      paidAmount: currentPaid,
      consumedAmount: normalizedConsumedAmount,
      refundedAmount: computedRefundAmount,
      cancellationConcession,
      refundMode,
      refundReceiptNo: refundRecord?.refundReceiptNo || null,
    }
  };
};


module.exports = { updateFacility, removeFacility: exports.removeFacility };
