const StudentTransaction = require("../api/feePayments/model.studentFeePayments");

const dateWiseTransaction = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "fromDate and toDate are required"
      });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const records = await StudentTransaction.find().populate("student");

    const rows = [];

    for (const doc of records) {
      const student = doc.student;

      for (const tx of doc.transactions) {
        const billingDate = new Date(tx.billingDate);

        if (billingDate < start || billingDate > end) continue;

        for (const b of tx.breakdowns) {

          const base = {
            studentName: student.personal.studentName,
            rollNo: student.personal.rollNo,
            department: student.academic.departmentName,
            year: student.academic.yearStudying,
            section: student.academic.section,
            profileImage: student.personal.studentPhoto,

            sem: b.academic.semesterNumber,
            academicYear: b.academicYear,

            date: billingDate.toISOString().split("T")[0],
            paymentMode: tx.paymentType,
            bank: tx.bankName,
            receiptNo: tx.receiptNo
          };

          // Academic fees total
          const academicTotal =
            (b.academic.tuition || 0) +
            (b.academic.exam || 0) +
            (b.academic.erp || 0) +
            (b.academic.book || 0) +
            (b.academic.lab || 0);

          if (academicTotal > 0) {
            rows.push({
              ...base,
              feeHead: "Academic",
              amount: academicTotal
            });
          }

          if (b.hostel > 0) {
            rows.push({
              ...base,
              feeHead: "Hostel",
              amount: b.hostel
            });
          }

          if (b.transport > 0) {
            rows.push({
              ...base,
              feeHead: "Transport",
              amount: b.transport
            });
          }

        }
      }
    }

    res.json({
      success: true,
      count: rows.length,
      data: rows
    });

  } catch (error) {
    console.error("Date Wise Transaction Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

module.exports = {
  dateWiseTransaction
};