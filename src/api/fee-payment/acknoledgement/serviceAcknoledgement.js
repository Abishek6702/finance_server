const StudentTransaction = require("../payments/model/modelStudentFeePayments");
const Studentacknoledgement = require("./modelacknoledgement");
const { StudentacknoledgementV2 } = require("./modelacknoledgement");
const StudentFeeTracking = require("../student-fee-tracking/modelStudentFeeTracking");
const Student = require("../../student/students-management/modelStudent");
const ReceiptCounter = require("../payments/model/modelReceiptCounter");
const mongoose = require("mongoose");
const AppError = require("../../../utils/appError");

const parseBillingDate = (billingDate) => {
  if (!billingDate) return new Date();
  if (typeof billingDate === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(billingDate)) {
    const [dd, mm, yyyy] = billingDate.split("/");
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(billingDate);
  if (!isNaN(d.getTime())) return d;
  return new Date();
};

const normalizeMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
};

const setStatus = (target) => {
  if (!target) return;
  if (target.total === 0) target.status = "Paid";
  else if (target.paid >= target.total) target.status = "Paid";
  else if (target.paid > 0) target.status = "Partial";
  else target.status = "Unpaid";
};

const getNextReceiptNo = async ({ session = null } = {}) => {
  const now = new Date();

  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}${mm}${dd}`;

  const counter = await ReceiptCounter.findOneAndUpdate(
    { date: dateStr },
    { $inc: { sequence: 1 } },
    {
      new: true,
      upsert: true
    }
  ).session(session);

  const countStr = String(counter.sequence).padStart(3, "0");

  return {
    receiptNo: `REC-${dateStr}-${countStr}`
  };
};

const createAcknowledgment = async (data) => {
  const { rollNo, paymentType, bankName, bankLocation, billingDate, breakdowns, excessAmount, totalAmount, reductionId } = data;
  if (paymentType === "reduction" && !mongoose.Types.ObjectId.isValid(reductionId)) {
    throw new AppError("reductionId is required as a valid MongoDB ObjectId when paymentType is reduction", 400);
  }
  const { receiptNo } = await getNextReceiptNo();
  const tracking = await StudentFeeTracking.findOne({ rollNo });
  if (!tracking) throw new AppError("Fee tracking not found for this student", 404);

  const isExcessPayment = paymentType === "excessAmount";
  const topUpAmount = normalizeMoney(excessAmount || 0);
  let studentDoc = null;
  let availableExcess = 0;

  if (isExcessPayment || topUpAmount > 0) {
    studentDoc = await Student.findOne({ "personal.rollNo": rollNo });
    if (!studentDoc) throw new AppError("Student not found", 404);

    const currentExcess = normalizeMoney(studentDoc.enrollment?.excessAmount || 0);
    availableExcess = normalizeMoney(currentExcess + topUpAmount);

    if (isExcessPayment && availableExcess <= 0) {
      throw new AppError("Excess amount is not available for this student", 400);
    }
  }

  let grandTotal = 0;
  const proposedAcademicByYear = {};
  const seenAcademicKeys = new Set();
  const seenHostelKeys = new Set();
  const seenTransportKeys = new Set();

  for (const bd of breakdowns) {
    const yearRecord = tracking.academicYearWiseRecord.find(r => r.academicYear === bd.academicYear);
    if (!yearRecord) throw new AppError(`Academic year ${bd.academicYear} not found in fee tracking`, 404);

    if (bd.academic && !bd.academic.semesterNumber) {
      const hasAcademicFees = ["tuition", "exam", "erp", "book", "lab"].some(
        f => normalizeMoney(bd.academic[f] || 0) > 0
      );
      if (hasAcademicFees) {
        throw new AppError("semesterNumber is required when academic fee amounts are provided", 400);
      }
    }

    if (bd.academic && bd.academic.semesterNumber) {
      const academicKey = `${bd.academicYear}-sem${bd.academic.semesterNumber}`;
      if (seenAcademicKeys.has(academicKey)) {
        throw new AppError(
          `Duplicate breakdown for semester ${bd.academic.semesterNumber} in ${bd.academicYear}. Combine amounts into a single breakdown.`, 400
        );
      }
      seenAcademicKeys.add(academicKey);
      const semSlot = bd.academic.semesterNumber % 2 === 1 ? "odd" : "even";
      const sem = yearRecord.academic?.[semSlot];
      if (!sem) throw new AppError(`Semester ${bd.academic.semesterNumber} not found in tracking for ${bd.academicYear}`, 404);

      if (sem.semesterNumber !== bd.academic.semesterNumber) {
        throw new AppError(
          `Semester ${bd.academic.semesterNumber} does not belong to academic year ${bd.academicYear}. ` +
          `This year has semester ${sem.semesterNumber} in the ${semSlot} slot.`, 400
        );
      }

      const fields = ["tuition", "exam", "erp", "book", "lab"];
      let semAcademicPayment = 0;
      for (const field of fields) {
        const payAmount = normalizeMoney(bd.academic[field] || 0);
        if (payAmount > 0) {
          const total = normalizeMoney(sem[field]?.total || 0);
          const paid = normalizeMoney(sem[field]?.paid || 0);
          const remaining = normalizeMoney(total - paid);
          if (payAmount > remaining) {
            throw new AppError(
              `${field} payment INR ${payAmount} exceeds remaining concession-adjusted due INR ${remaining} for Semester ${bd.academic.semesterNumber} (${bd.academicYear})`, 400
            );
          }
          grandTotal += payAmount;
          semAcademicPayment += payAmount;
        }
      }
      proposedAcademicByYear[bd.academicYear] = normalizeMoney(
        (proposedAcademicByYear[bd.academicYear] || 0) + semAcademicPayment
      );
    }

    if (bd.hostel && normalizeMoney(bd.hostel) > 0) {
      if (seenHostelKeys.has(bd.academicYear)) {
        throw new AppError(
          `Duplicate hostel payment for ${bd.academicYear}. Combine amounts into a single breakdown.`, 400
        );
      }
      seenHostelKeys.add(bd.academicYear);
      if (!yearRecord.hostel) throw new AppError(`No hostel fee record found for ${bd.academicYear}`, 404);
      if (yearRecord.hostel.isActive === false) {
        throw new AppError(`Cannot process hostel payment for ${bd.academicYear} as the facility is inactive`, 400);
      }
      const hostelRemaining = normalizeMoney(
        (yearRecord.hostel.total?.total || 0) - (yearRecord.hostel.total?.paid || 0)
      );
      if (normalizeMoney(bd.hostel) > hostelRemaining) {
        throw new AppError(
          `Hostel payment INR ${bd.hostel} exceeds remaining concession-adjusted due INR ${hostelRemaining} for ${bd.academicYear}`, 400
        );
      }
      grandTotal += normalizeMoney(bd.hostel);
    }

    if (bd.transport && normalizeMoney(bd.transport) > 0) {
      if (seenTransportKeys.has(bd.academicYear)) {
        throw new AppError(
          `Duplicate transport payment for ${bd.academicYear}. Combine amounts into a single breakdown.`, 400
        );
      }
      seenTransportKeys.add(bd.academicYear);
      if (!yearRecord.transport) throw new AppError(`No transport fee record found for ${bd.academicYear}`, 404);
      if (yearRecord.transport.isActive === false) {
        throw new AppError(`Cannot process transport payment for ${bd.academicYear} as the facility is inactive`, 400);
      }
      const transportRemaining = normalizeMoney(
        (yearRecord.transport.total?.total || 0) - (yearRecord.transport.total?.paid || 0)
      );
      if (normalizeMoney(bd.transport) > transportRemaining) {
        throw new AppError(
          `Transport payment INR ${bd.transport} exceeds remaining concession-adjusted due INR ${transportRemaining} for ${bd.academicYear}`, 400
        );
      }
      grandTotal += normalizeMoney(bd.transport);
    }
  }

  for (const [academicYear, proposedAmount] of Object.entries(proposedAcademicByYear)) {
    if (proposedAmount <= 0) continue;
    const yearRecord = tracking.academicYearWiseRecord.find(r => r.academicYear === academicYear);
    if (!yearRecord?.academic) continue;
    const netAcademicTotal = normalizeMoney(yearRecord.academic.total?.total || 0);
    const alreadyPaid = normalizeMoney(yearRecord.academic.total?.paid || 0);
    const academicRemaining = normalizeMoney(netAcademicTotal - alreadyPaid);
    if (proposedAmount > academicRemaining) {
      throw new AppError(
        `Academic payment INR ${proposedAmount} exceeds net remaining due INR ${academicRemaining} for ${academicYear} (after concessions)`, 400
      );
    }
  }

  if (grandTotal <= 0) {
    throw new AppError("Total payment amount must be greater than 0", 400);
  }

  if (totalAmount !== undefined && normalizeMoney(totalAmount) !== normalizeMoney(grandTotal)) {
    throw new AppError(
      `Provided totalAmount INR ${normalizeMoney(totalAmount)} does not match computed breakdown total INR ${normalizeMoney(grandTotal)}`,
      400
    );
  }

  if (isExcessPayment && availableExcess < grandTotal) {
    throw new AppError(
      `Excess amount INR ${availableExcess} is insufficient to cover total payable INR ${grandTotal}`,
      400
    );
  }

  let acknoledgementDoc = await Studentacknoledgement.findOne({ rollNo });
  if (!acknoledgementDoc) {
    const student = studentDoc || await Student.findOne({ "personal.rollNo": rollNo });
    if (!student) throw new AppError("Student not found", 404);
    acknoledgementDoc = new Studentacknoledgement({
      student: student._id,
      rollNo,
      acknoledgements: []
    });
  }

  const mappedBreakdowns = breakdowns.map(bd => {
    const academic = bd.academic || {};
    const feeHeads = [];

    for (const field of ["tuition", "exam", "erp", "book", "lab"]) {
      const fee = normalizeMoney(academic[field] || 0);
      if (fee > 0) feeHeads.push({ type: field, fee });
    }

    const hostelFee = normalizeMoney(bd.hostel || 0);
    if (hostelFee > 0) feeHeads.push({ type: "hostel", fee: hostelFee });

    const transportFee = normalizeMoney(bd.transport || 0);
    if (transportFee > 0) feeHeads.push({ type: "transport", fee: transportFee });

    const total = normalizeMoney(feeHeads.reduce((sum, fh) => sum + fh.fee, 0));

    return {
      academicYear: bd.academicYear,
      semesterNumber: academic.semesterNumber || null,
      feeHeads,
      total
    };
  });

  acknoledgementDoc.acknoledgements.push({
    receiptNo,
    paymentType,
    bankName,
    bankLocation,
    reductionId: paymentType === "reduction" ? reductionId : null,
    excessAmount: topUpAmount,
    totalAmount: grandTotal,
    billingDate: parseBillingDate(billingDate),
    createdAt: new Date(),
    breakdowns: mappedBreakdowns
  });

  await acknoledgementDoc.save();

  return receiptNo;
};

const updateAcknowledgment = async (data) => {
  const { rollNo, receiptNo, status } = data;

  const ackDoc = await Studentacknoledgement.findOne({ rollNo });
  if (!ackDoc) throw new AppError("No acknowledgements found for this student", 404);

  const ackRecord = ackDoc.acknoledgements.find(a => a.receiptNo === receiptNo);
  if (!ackRecord) throw new AppError("Acknowledgement record not found", 404);

  if (ackRecord.status !== "RECEIVED") {
    throw new AppError(`Acknowledgement is already ${ackRecord.status}`, 400);
  }

  ackRecord.status = status;
  await ackDoc.save();

  if (status === "REJECTED") {
    return { receiptNo, status };
  }

  const tracking = await StudentFeeTracking.findOne({ rollNo });
  if (!tracking) throw new AppError("Fee tracking not found for this student", 404);

  let studentDoc = await Student.findOne({ "personal.rollNo": rollNo });
  if (!studentDoc) throw new AppError("Student not found", 404);

  const ackTotalAmount = normalizeMoney(ackRecord.totalAmount || 0);
  const ackTopUpAmount = normalizeMoney(ackRecord.excessAmount || 0);
  const isExcessPayment = ackRecord.paymentType === "excessAmount";
  const currentExcess = normalizeMoney(studentDoc.enrollment?.excessAmount || 0);
  const availableExcess = normalizeMoney(currentExcess + ackTopUpAmount);

  if (isExcessPayment && availableExcess < ackTotalAmount) {
    throw new AppError(
      `Excess amount INR ${availableExcess} is insufficient to cover total payable INR ${ackTotalAmount}`,
      400
    );
  }

  let transactionDoc = await StudentTransaction.findOne({ rollNo });
  if (!transactionDoc) {
    transactionDoc = new StudentTransaction({
      student: studentDoc._id,
      rollNo,
      transactions: []
    });
  }

  transactionDoc.transactions.push({
    receiptNo: ackRecord.receiptNo,
    paymentType: ackRecord.paymentType,
    bankName: ackRecord.bankName,
    bankLocation: ackRecord.bankLocation,
    reductionId: ackRecord.paymentType === "reduction" ? ackRecord.reductionId : null,
    excessAmount: ackTopUpAmount,
    totalAmount: ackTotalAmount,
    billingDate: ackRecord.billingDate,
    createdAt: new Date(),
    breakdowns: ackRecord.breakdowns
  });

  await transactionDoc.save();

  for (const bd of ackRecord.breakdowns) {
    const yearRecord = tracking.academicYearWiseRecord.find(r => r.academicYear === bd.academicYear);
    if (!yearRecord) continue;

    const addPayment = (target, amount) => {
      if (!target || !amount) return;
      const increment = normalizeMoney(amount);
      target.total = normalizeMoney(target.total || 0);
      target.paid = normalizeMoney((target.paid || 0) + increment);
      target.paid = Math.min(target.paid, target.total);
      setStatus(target);
    };

    let termUpdated = false;
    for (const head of bd.feeHeads) {
      if (head.fee <= 0) continue;

      if (head.type === "hostel" && yearRecord.hostel) {
        addPayment(yearRecord.hostel.total, head.fee);
      } else if (head.type === "transport" && yearRecord.transport) {
        addPayment(yearRecord.transport.total, head.fee);
      } else {
        if (bd.semesterNumber) {
          const sem = bd.semesterNumber % 2 === 1 ? yearRecord.academic.odd : yearRecord.academic.even;
          if (sem && sem[head.type]) {
            addPayment(sem[head.type], head.fee);
            termUpdated = true;
          }
        }
      }
    }

    if (termUpdated && bd.semesterNumber) {
      const sem = bd.semesterNumber % 2 === 1 ? yearRecord.academic.odd : yearRecord.academic.even;
      if (sem) {
        const semPaid = normalizeMoney((sem.tuition?.paid || 0) + (sem.exam?.paid || 0) + (sem.erp?.paid || 0) + (sem.book?.paid || 0) + (sem.lab?.paid || 0));
        sem.total.paid = Math.min(semPaid, normalizeMoney(sem.total.total || 0));
        setStatus(sem.total);
      }
      const termTotalPaid = normalizeMoney((yearRecord.academic.odd?.total?.paid || 0) + (yearRecord.academic.even?.total?.paid || 0));
      yearRecord.academic.total.paid = Math.min(termTotalPaid, normalizeMoney(yearRecord.academic.total.total || 0));
      setStatus(yearRecord.academic.total);
    }
    const yearPaid = normalizeMoney((yearRecord.academic.total?.paid || 0) + (yearRecord.hostel?.total?.paid || 0) + (yearRecord.transport?.total?.paid || 0));
    yearRecord.total.paid = Math.min(yearPaid, normalizeMoney(yearRecord.total.total || 0));
    setStatus(yearRecord.total);
  }

  tracking.markModified("academicYearWiseRecord");
  await tracking.save();

  const newExcess = isExcessPayment
    ? normalizeMoney(availableExcess - ackTotalAmount)
    : normalizeMoney(availableExcess);

  studentDoc.enrollment = studentDoc.enrollment || {};
  studentDoc.enrollment.excessAmount = newExcess;
  studentDoc.enrollment.isExcessAmountTrue = newExcess > 0;
  await studentDoc.save();

  return { receiptNo, status };
};

const createAcknowledgmentV2 = async (data) => {
  const { rollNo, paymentType, bankName, totalAmount, date, message } = data;

  const studentExists = await Student.exists({ "personal.rollNo": rollNo });
  if (!studentExists) {
    throw new AppError("Student not found", 404);
  }

  const ackId = `ACKV2-${new mongoose.Types.ObjectId().toString().slice(-12).toUpperCase()}`;

  const created = await StudentacknoledgementV2.create({
    ackId,
    rollNo,
    paymentType,
    bankName,
    totalAmount,
    status: "RECEIVED",
    date,
    message: message || "Acknowledgment received",
  });

  return {
    ackId: created.ackId,
    rollNo: created.rollNo,
    paymentType: created.paymentType,
    bankName: created.bankName,
    totalAmount: created.totalAmount,
    status: created.status,
    date: created.date,
    message: created.message,
  };
};

const getAcknowledgmentV2ByAckId = async (ackId) => {
  const ack = await StudentacknoledgementV2.findOne({ ackId }).lean();
  if (!ack) {
    throw new AppError("Acknowledgment V2 not found", 404);
  }
  return ack;
};

const updateAcknowledgmentV2 = async (data) => {
  const { rollNo, ackId, status, message } = data;

  const ack = await StudentacknoledgementV2.findOne({ ackId, rollNo });
  if (!ack) {
    throw new AppError("Acknowledgment V2 not found for this rollNo", 404);
  }

  ack.status = status === "approved" ? "SUCCESSFUL" : "REJECTED";
  ack.message = message || (status === "approved" ? "Acknowledgment approved" : "Acknowledgment rejected");
  ack.date = new Date();

  await ack.save();

  return {
    ackId: ack.ackId,
    rollNo: ack.rollNo,
    status: ack.status,
    date: ack.date,
    message: ack.message,
  };
};

const getAcknowledgments = async (query = {}) => {
  const acks = await Studentacknoledgement.find(query).sort({ createdAt: -1 });
  return acks;
};

const getAcknowledgmentById = async (id) => {
  const ack = await Studentacknoledgement.findById(id);
  if (!ack) {
    throw new AppError("Acknowledgment not found", 404);
  }
  return ack;
};

const getAcknowledgmentV2 = async (query = {}) => {
  const acks = await StudentacknoledgementV2.find(query).sort({ createdAt: -1 });
  return acks;
};

module.exports = {
  getAcknowledgments,
  getAcknowledgmentById,
  getAcknowledgmentV2,
  createAcknowledgment,
  updateAcknowledgment,
  createAcknowledgmentV2,
  getAcknowledgmentV2ByAckId,
  updateAcknowledgmentV2
};
