
```
backend/
├── .env
├── .gitignore
├── README.md
├── data.csv
├── find-recalls.js
├── m.json
├── package.json
├── package-lock.json
├── update-postman.js
└── src/
    ├── seed.js
    ├── server.js
    ├── api/
    │   ├── auth/
    │   │   ├── controller.auth.js
    │   │   ├── doc.auth.md
    │   │   ├── model.user.js
    │   │   ├── routes.auth.js
    │   │   ├── service.auth.js
    │   │   └── validation.auth.js
    │   ├── feedetails/
    │   │   ├── controller.feedetails.js
    │   │   ├── doc.feedetails.md
    │   │   ├── routes.feedetails.js
    │   │   ├── service.feedetails.js
    │   │   └── validation.feedetails.js
    │   ├── feePayments/
    │   │   ├── controller.feePayments.js
    │   │   ├── doc.feePayments.md
    │   │   ├── model.receiptCounter.js
    │   │   ├── model.studentFeePayments.js
    │   │   ├── routes.feePayments.js
    │   │   ├── service.feePayments.js
    │   │   └── validation.feePayments.js
    │   ├── feeStructure/
    │   │   ├── acadamic/
    │   │   │   ├── controller.acadamic.js
    │   │   │   ├── doc.acadamic.md
    │   │   │   ├── model.acadamic.js
    │   │   │   ├── new.doc.md
    │   │   │   ├── routes.acadamic.js
    │   │   │   ├── service.acadamic.js
    │   │   │   └── validation.acadamic.js
    │   │   ├── hostel/
    │   │   │   ├── controller.hostel.js
    │   │   │   ├── doc.hostel.md
    │   │   │   ├── model.hostel.js
    │   │   │   ├── routes.hostel.js
    │   │   │   ├── service.hostel.js
    │   │   │   └── validation.hostel.js
    │   │   └── transport/
    │   │       ├── controller.transport.js
    │   │       ├── doc.transport.md
    │   │       ├── model.transport.js
    │   │       ├── routes.transport.js
    │   │       ├── service.transport.js
    │   │       └── validation.transport.js
    │   ├── StudentFacilityManagement/
    │   │   ├── controller.StudentFacilityManagement.js
    │   │   ├── doc.StudentFacilityManagement.md
    │   │   ├── plan.md
    │   │   ├── routes.StudentFacilityManagement.js
    │   │   ├── service.StudentFacilityManagement.js
    │   │   └── validation.StudentFacilityManagement.js
    │   ├── students/
    │   │   ├── controller.students.js
    │   │   ├── doc.students.md
    │   │   ├── model.student.js
    │   │   ├── routes.students.js
    │   │   ├── service.students.js
    │   │   ├── utils.bulkParse.js
    │   │   ├── utils.students.js
    │   │   └── validation.students.js
    │   └── superadmin/
    │       ├── controller.superadmin.js
    │       └── routes.superadmin.js
    ├── config/
    │   └── db.js
    ├── controllers/
    │   └── transactionController.js      ← legacy (pre-refactor)
    ├── data/                              ← empty
    ├── middleware/
    │   ├── authMiddleware.js
    │   ├── corsMiddleware.js
    │   └── errorHandler.js
    ├── models/
    │   └── ActivityLog.js
    ├── postman/
    │   ├── Postman Quick-Start Guide.md
    │   ├── Qpulse_Finance_API.postman_collection.json
    │   └── Qpulse_Finance_Local.postman_environment.json
    ├── routes/
    │   └── transactionRoutes.js          ← legacy (pre-refactor)
    ├── test/
    │   ├── auth.test.js
    │   ├── feedetails.test.js
    │   ├── feePayments.test.js
    │   ├── feeStructure.test.js
    │   ├── globalLifecycle.js
    │   ├── receiptRecall.test.js
    │   ├── reporter.js
    │   ├── reports.test.js
    │   ├── setup.js
    │   ├── StudentFacilityManagement.test.js
    │   ├── studentFeeTracking.test.js
    │   ├── students.test.js
    │   ├── studentsBulk.test.js
    │   └── test.js
    └── utils/
        ├── AppError.js
        ├── asyncHandler.js
        ├── generateLedger.js
        ├── generateToken.js
        ├── sendMail.js
        └── templateHandler.js

```


api/
    │
    feePayment/
       │
       ├── receiptRecall/   
       │   ├── controller.receiptRecall.js
       │   ├── doc.receiptRecall.md
       │   ├── model.receiptRecall.js
       │   ├── routes.receiptRecall.js
       │   ├── service.receiptRecall.js
       │   └── validation.receiptRecall.js
       ├── reports/ 
       │   ├── controller.reports.js
       │   ├── doc.report.md
       │   ├── routes.reports.js
       │   ├── service.reports.js
       │   └── validation.reports.js
       ├── studentFeeTracking/ 
       │   ├── controller.studentFeeTracking.js
       │   ├── doc.studentFeeTracking.md
       │   ├── model.studentFeeTracking.js
       │   ├── routes.studentFeeTracking.js
       │   ├── service.studentFeeTracking.js
       │   └── validation.studentFeeTracking.js