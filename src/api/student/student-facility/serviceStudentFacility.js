const Student = require("../students-management/modelStudent");
const { Transport } = require("../../fee-structure/transport/modelTransport");
const { Hostel } = require("../../fee-structure/hostel/modelHostel");
const StudentFeeTracking = require("../../fee-payment/student-fee-tracking/modelStudentFeeTracking");
const feePaymentsService = require("../../fee-payment/payments/serviceFeePayments");
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

function isStudentFacilityActive(facility) {
  if (!facility?.isApplicable) return false;
  if (facility.isActive === false) return false;
  return !facility.endDate || new Date(facility.endDate) > new Date();
}

function hasActiveFacilityInTracking(tracking, facilityType) {
  return (
    tracking?.academicYearWiseRecord?.some((yearRecord) => {
      const facility = yearRecord?.[facilityType];
      if (!facility) return false;
      if (facility.isActive === false) return false;
      return !facility.endDate || new Date(facility.endDate) > new Date();
    }) || false
  );
}

const assignFacility = async (rollNo, { transport, hostel, applyFromAcademicYear, effectiveDate, reduction }, session = null) => {
  /* ─── Phase 1: Fetch student ─── */
  const student = await Student.findOne({ "personal.rollNo": rollNo.toUpperCase() }).session(session);
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

  /* ─── Phase 3: Fetch Tracking & Master Docs & Active Checks ─── */
  const tracking = await StudentFeeTracking.findOne({ rollNo: rollNo.toUpperCase() }).session(session);
  const resolvedEffectiveDate = effectiveDate ? new Date(effectiveDate) : new Date();

  const assignTransport = transport?.isApplicable === true;
  const assignHostel = hostel?.isApplicable === true;

  // Assigning both together is allowed only when both facilities are currently inactive.
  if (assignTransport && assignHostel) {
    const hasAnyActiveTransport =
      isStudentFacilityActive(student.transport) ||
      hasActiveFacilityInTracking(tracking, "transport");

    const hasAnyActiveHostel =
      isStudentFacilityActive(student.hostel) ||
      hasActiveFacilityInTracking(tracking, "hostel");

    if (hasAnyActiveTransport || hasAnyActiveHostel) {
      throw new AppError(
        "Both facilities can be assigned together only when existing hostel and transport are inactive",
        400
      );
    }
  }

  let resolvedTransport = null;
  if (transport !== undefined && transport.isApplicable) {
    const transportDoc = await Transport.findById(transport.id).session(session);
    if (!transportDoc) {
      throw new AppError(`Transport not found for id "${transport.id}"`, 404);
    }
    resolvedTransport = {
      isApplicable: true,
      transport: transportDoc.id,
      route: transportDoc.route,
      busNo: transportDoc.busNo,
      stop: transportDoc.stop,
      fee: transportDoc.fee,
      effectiveDate: resolvedEffectiveDate,
      consumedAmount: 0,
      endDate: null,
    };
  }

  let resolvedHostel = null;
  if (hostel !== undefined && hostel.isApplicable) {
    const hostelDoc = await Hostel.findById(hostel.id).session(session);
    if (!hostelDoc) {
      throw new AppError(`Hostel not found for id "${hostel.id}"`, 404);
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
          if (!yearRecord.transport) yearRecord.transport = { total: { total: 0 } };
          yearRecord.transport.transport = resolvedTransport.transport;
          yearRecord.transport.route = resolvedTransport.route;
          yearRecord.transport.busNo = resolvedTransport.busNo;
          yearRecord.transport.stop = resolvedTransport.stop;
          yearRecord.transport.fee = resolvedTransport.fee;
          yearRecord.transport.subTotal = normalizeMoney(resolvedTransport.fee);
          yearRecord.transport.isActive = true;
          yearRecord.transport.effectiveDate = resolvedTransport.effectiveDate;
          yearRecord.transport.endDate = null;
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
          if (!yearRecord.hostel) yearRecord.hostel = { total: { total: 0 } };
          yearRecord.hostel.hostel = resolvedHostel.hostel;
          yearRecord.hostel.block = resolvedHostel.block;
          yearRecord.hostel.sharing = resolvedHostel.sharing;
          yearRecord.hostel.isAttached = resolvedHostel.isAttached;
          yearRecord.hostel.fee = resolvedHostel.fee;
          yearRecord.hostel.subTotal = normalizeMoney(resolvedHostel.fee);
          yearRecord.hostel.isActive = true;
          yearRecord.hostel.effectiveDate = resolvedHostel.effectiveDate;
          yearRecord.hostel.endDate = null;
        }
        trackingTouched = true;
      }
    }

    if (trackingTouched) {
      tracking.markModified("academicYearWiseRecord");
      await tracking.save({ session });
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

  await student.save({ session });

  const normalizedReduction = normalizeMoney(reduction || 0);
  const isTransportAssigned = transport?.isApplicable === true;
  const isHostelAssigned = hostel?.isApplicable === true;

  if (normalizedReduction > 0) {
    if (isTransportAssigned && isHostelAssigned) {
      throw new AppError(
        "reduction can be used only when assigning exactly one facility per request",
        400
      );
    }

    if (!isTransportAssigned && !isHostelAssigned) {
      throw new AppError(
        "reduction can be applied only when assigning a new hostel or transport facility",
        400
      );
    }

    if (!tracking) {
      throw new AppError("Fee tracking not found for this student", 404);
    }

    const applyFromRecord = tracking.academicYearWiseRecord.find(
      (r) => r.academicYear === applyFromAcademicYear
    );

    if (!applyFromRecord) {
      throw new AppError(
        `Academic year ${applyFromAcademicYear} not found in fee tracking`,
        404
      );
    }

    const ledgerTotal = isTransportAssigned
      ? normalizeMoney(applyFromRecord.transport?.total?.total || 0)
      : normalizeMoney(applyFromRecord.hostel?.total?.total || 0);

    const facilityLabel = isTransportAssigned ? "transport" : "hostel";
    const effectiveDateText = resolvedEffectiveDate.toISOString().slice(0, 10);
    const reason = `Student partially added ${facilityLabel} facility from ${effectiveDateText}. Reduction amount Rs ${normalizedReduction} adjusted against total Rs ${ledgerTotal} for ${applyFromAcademicYear}.`;

    const reductionBreakdown = {
      academicYear: applyFromAcademicYear,
      hostel: isHostelAssigned ? normalizedReduction : 0,
      transport: isTransportAssigned ? normalizedReduction : 0,
    };

    await feePaymentsService.createPayment({
      rollNo: rollNo.toUpperCase(),
      paymentType: "reduction",
      reason,
      breakdowns: [reductionBreakdown],
    }, { session });
  }

  const message = trackingTouched
    ? "Facility updated successfully"
    : "Student profile updated; no matching fee tracking records found for the target year range";

  return { student, message };
};

const cancelFacility = async (rollNo, payload, userId, session = null) => {
  const {
    facilityType,
    applyFromAcademicYear,
    endDate,
    conceptionAmount,
    refundMode,
    refundAmount,
    idempotencyKey,
    collegeAccount,
    studentBankName,
    studentAccount,
  } = payload;

  const normalizedRollNo = rollNo.toUpperCase();

  const student = await Student.findOne({ "personal.rollNo": normalizedRollNo }).session(session);
  if (!student) throw new AppError("Student not found", 404);

  const tracking = await StudentFeeTracking.findOne({ rollNo: normalizedRollNo }).session(session);
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

  const currentPaid = normalizeMoney(ledger.total?.paid || 0);

  const hasSettlementInput =
    conceptionAmount !== undefined || refundMode !== undefined || refundAmount !== undefined;

  if (currentPaid <= 0 && conceptionAmount !== undefined && normalizeMoney(conceptionAmount) > 0) {
    throw new AppError("conceptionAmount must be 0 when paid amount is 0", 400);
  }

  if (currentPaid <= 0 && refundAmount !== undefined && normalizeMoney(refundAmount) > 0) {
    throw new AppError("refundAmount must be 0 when paid amount is 0", 400);
  }

  if (currentPaid > 0) {
    if (conceptionAmount === undefined) {
      throw new AppError("conceptionAmount is required when paid amount is greater than 0", 400);
    }
  }

  if (refundMode !== undefined && !["wallet", "cash", "bank"].includes(refundMode)) {
    throw new AppError("refundMode must be wallet, cash, or bank when provided", 400);
  }

  const normalizedConsumedAmount = normalizeMoney(conceptionAmount || 0);

  if (normalizedConsumedAmount > currentPaid) {
    throw new AppError(
      `consumed amount ₹${normalizedConsumedAmount} cannot exceed paid amount ₹${currentPaid}`,
      400
    );
  }

  const computedRefundAmount = normalizeMoney(Math.max(0, currentPaid - normalizedConsumedAmount));

  if (computedRefundAmount > 0 && !refundMode) {
    throw new AppError("refundMode is required when refund amount is greater than 0", 400);
  }

  if (computedRefundAmount > 0 && refundMode === "bank") {
    if (!collegeAccount || !String(collegeAccount).trim()) {
      throw new AppError("collegeAccount is required when refundMode is bank", 400);
    }
    if (!studentBankName || !String(studentBankName).trim()) {
      throw new AppError("studentBankName is required when refundMode is bank", 400);
    }
    if (!studentAccount || !String(studentAccount).trim()) {
      throw new AppError("studentAccount is required when refundMode is bank", 400);
    }
  }

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
        reason: `Facility removed via ${refundMode || "system"}`,
        isActive: false,
        idempotencyKey,
        collegeAccount: refundMode === "bank" ? String(collegeAccount).trim() : null,
        studentBankName: refundMode === "bank" ? String(studentBankName).trim() : null,
        studentAccount: refundMode === "bank" ? String(studentAccount).trim() : null,
      },
      userId,
      { session }
    );
  }

  const refreshedTracking = await StudentFeeTracking.findOne({ rollNo: normalizedRollNo }).session(session);
  if (!refreshedTracking) throw new AppError("Fee tracking record not found after refund processing", 404);

  const refreshedYear = refreshedTracking.academicYearWiseRecord.find(
    (record) => record.academicYear === applyFromAcademicYear
  );
  if (!refreshedYear) throw new AppError(`Academic year ${applyFromAcademicYear} not found in tracking`, 404);

  const refreshedLedger = facilityType === 'transport' ? refreshedYear.transport : refreshedYear.hostel;
  if (!refreshedLedger) throw new AppError(`${facilityType} ledger not found for the academic year`, 404);

  refreshedLedger.consumedAmount = normalizedConsumedAmount;
  refreshedLedger.total.paid = 0;
  refreshedLedger.total.status = currentPaid > 0 ? 'Refunded' : refreshedLedger.total.status || 'Unpaid';
  refreshedLedger.isActive = false;
  refreshedLedger.endDate = new Date(endDate);

  refreshedTracking.markModified("academicYearWiseRecord");
  await refreshedTracking.save({ session });

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

  await student.save({ session });

  return {
    student,
    tracking: refreshedTracking,
    settlement: {
      facilityType,
      paidAmount: currentPaid,
      consumedAmount: normalizedConsumedAmount,
      refundedAmount: computedRefundAmount,
      refundMode: refundMode || (hasSettlementInput ? null : "not-required-paid-zero"),
      refundReceiptNo: refundRecord?.refundReceiptNo || null,
    }
  };
};

const cancelAndAssign = async (rollNo, payload, userId, session = null) => {
  const { cancel, assign, idempotencyKey } = payload || {};

  if (!cancel || !assign) {
    throw new AppError("Both cancel and assign blocks are required", 400);
  }

  if (!idempotencyKey || String(idempotencyKey).trim().length === 0) {
    throw new AppError("x-idempotency-key header is required for cancel-assign operation", 400);
  }

  const normalizedRollNo = rollNo.toUpperCase();
  const student = await Student.findOne({ "personal.rollNo": normalizedRollNo }).session(session);
  if (!student) throw new AppError("Student not found", 404);

  const assignFacilityType = assign.transport ? "transport" : "hostel";

  // Defensive guard: this flow should never accept assign-only shortcuts.
  if (!cancel.facilityType) {
    const alreadyActive =
      assignFacilityType === "transport"
        ? isStudentFacilityActive(student.transport)
        : isStudentFacilityActive(student.hostel);

    if (alreadyActive) {
      throw new AppError(
        `Cannot assign ${assignFacilityType} without cancellation because the facility is already active`,
        409
      );
    }
  }

  const cancelResult = await cancelFacility(
    normalizedRollNo,
    {
      ...cancel,
      idempotencyKey,
    },
    userId,
    session
  );

  const assignPayload = {
    transport: assign.transport,
    hostel: assign.hostel,
    applyFromAcademicYear: assign.applyFromAcademicYear,
    effectiveDate: assign.effectiveDate,
    reduction: assign.reduction,
  };

  const assignResult = await assignFacility(normalizedRollNo, assignPayload, session);

  return {
    student: assignResult.student,
    settlement: cancelResult.settlement,
    message: assignResult.message,
  };
};


module.exports = { assignFacility, cancelFacility, cancelAndAssign };
