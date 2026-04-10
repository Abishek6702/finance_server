const { Student } = require("./modelDashboard");

const DEPARTMENT_OUTPUT_ORDER = [
  "CSE",
  "ECE",
  "MECH",
  "IT",
  "CCE",
  "EEE",
  "AIDS",
  "AIML",
  "Cyber Security",
  "CSBS",
];

const toOutputDepartmentName = (department) => {
  if (department === "CSE(CYB)") return "Cyber Security";
  return department;
};

exports.getStudentsCount = async ({ year }) => {
  const [summary] = await Student.aggregate([
    {
      $match: {
        "academic.currentAcademicYear": year,
        passedout: { $ne: true },
      },
    },
    {
      $group: {
        _id: null,
        totalStudents: { $sum: 1 },
        totalHostelers: {
          $sum: {
            $cond: [{ $eq: ["$hostel.isApplicable", true] }, 1, 0],
          },
        },
        totalDayscholars: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$hostel.isApplicable", true] },
                  { $ne: ["$transport.isApplicable", true] },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalTransporters: {
          $sum: {
            $cond: [{ $eq: ["$transport.isApplicable", true] }, 1, 0],
          },
        },
      },
    },
  ]);

  return {
    totalStudents: summary?.totalStudents || 0,
    totalHostelers: summary?.totalHostelers || 0,
    totalDayscholars: summary?.totalDayscholars || 0,
    totalTransporters: summary?.totalTransporters || 0,
  };
};

exports.getDepartmentDistribution = async ({ year, dept }) => {
  const [summary] = await Student.aggregate([
    {
      $match: {
        "academic.currentAcademicYear": year,
        "academic.departmentName": dept,
        passedout: { $ne: true },
      },
    },
    {
      $group: {
        _id: null,
        totalMembers: { $sum: 1 },
        hostelCount: {
          $sum: {
            $cond: [{ $eq: ["$hostel.isApplicable", true] }, 1, 0],
          },
        },
        dayscholarCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$hostel.isApplicable", true] },
                  { $ne: ["$transport.isApplicable", true] },
                ],
              },
              1,
              0,
            ],
          },
        },
        transportCount: {
          $sum: {
            $cond: [{ $eq: ["$transport.isApplicable", true] }, 1, 0],
          },
        },
      },
    },
  ]);

  return {
    totalMembers: summary?.totalMembers || 0,
    Hostel: summary?.hostelCount || 0,
    Dayscholar: summary?.dayscholarCount || 0,
    Transport: summary?.transportCount || 0,
  };
};

exports.getFeesStatus = async ({ year }) => {
  const rows = await Student.aggregate([
    {
      $match: {
        "academic.currentAcademicYear": year,
        passedout: { $ne: true },
      },
    },
    {
      $lookup: {
        from: "studentfeetrackings",
        localField: "_id",
        foreignField: "student",
        as: "tracking",
      },
    },
    {
      $unwind: {
        path: "$tracking",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        yearRecord: {
          $first: {
            $filter: {
              input: "$tracking.academicYearWiseRecord",
              as: "yr",
              cond: { $eq: ["$$yr.academicYear", year] },
            },
          },
        },
      },
    },
    {
      $group: {
        _id: "$academic.departmentName",
        paid: {
          $sum: {
            $cond: [{ $eq: ["$yearRecord.total.status", "Paid"] }, 1, 0],
          },
        },
        unpaid: {
          $sum: {
            $cond: [{ $eq: ["$yearRecord.total.status", "Paid"] }, 0, 1],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byDepartment = new Map();
  rows.forEach((row) => {
    const outputDept = toOutputDepartmentName(row._id);
    byDepartment.set(outputDept, {
      dept: outputDept,
      paid: row.paid || 0,
      unpaid: row.unpaid || 0,
    });
  });

  DEPARTMENT_OUTPUT_ORDER.forEach((dept) => {
    if (!byDepartment.has(dept)) {
      byDepartment.set(dept, { dept, paid: 0, unpaid: 0 });
    }
  });

  const ordered = DEPARTMENT_OUTPUT_ORDER.map((dept) => byDepartment.get(dept));
  const extras = [...byDepartment.values()].filter(
    (row) => !DEPARTMENT_OUTPUT_ORDER.includes(row.dept)
  );

  return {
    year,
    departments: [...ordered, ...extras],
  };
};
