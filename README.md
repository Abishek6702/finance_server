# QPulse Finance Backend

Fee management backend for educational institutions, built on Node.js, Express, and MongoDB.

## Tech Stack

- Node.js (CommonJS)
- Express 5
- Mongoose 9
- Jest + Supertest

## Project Layout

```text
backend/
  README.md
  package.json
  data.csv
  src/
    server.js
    seed.js
    api/
      auth/
      dashboard/
      fee-payment/
        acknoledgement/
        fee-demand/
        feedetails/
        payments/
        receipt-recall/
        refund/
        reports/
        student-fee-tracking/
      fee-structure/
        acadamic/
        hostel/
        transport/
      student/
        student-facility/
        students-management/
      superadmin/
    config/
    middleware/
    models/
    postman/
    test/
    utils/
```

## Route Prefixes

Registered in src/server.js:

- /api/auth
- /api/feeStructureMaster
- /api/studentsManagement
- /api/feePayment
- /api/feeAcknowledgement
- /api/studentFeeTracking
- /api/feedetails
- /api/feedemands
- /api/transport
- /api/hostel
- /api/receiptRecall
- /api/refund
- /api/superadmin
- /api/reports
- /api/studentFacility
- /api/dashboard

## Setup

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Install

```bash
npm install
```

### Environment

Create .env in the repository root:

```env
MONGO_URI=mongodb://localhost:27017/qpulse_finance
JWT_SECRET=your_jwt_secret
PORT=5010
```

### Run

```bash
npm run dev
```

### Test

```bash
npm test
```

The test command targets src/test/*Test.js using Jest in runInBand mode.

## Scripts

- npm start -> node src/server.js
- npm run dev -> nodemon src/server.js
- npm run build -> placeholder build step
- npm test -> Jest test run for src/test/*Test.js

## Module Documentation

API documentation files:

- Auth: [src/api/auth/docAuth.md](src/api/auth/docAuth.md)
- Dashboard: [src/api/dashboard/docDashboard.md](src/api/dashboard/docDashboard.md)
- Academic Fee Structure: [src/api/fee-structure/acadamic/docAcadamic.md](src/api/fee-structure/acadamic/docAcadamic.md)
- Hostel Fee Structure: [src/api/fee-structure/hostel/docHostel.md](src/api/fee-structure/hostel/docHostel.md)
- Transport Fee Structure: [src/api/fee-structure/transport/docTransport.md](src/api/fee-structure/transport/docTransport.md)
- Students Management: [src/api/student/students-management/docStudents.md](src/api/student/students-management/docStudents.md)
- Student Facility: [src/api/student/student-facility/docStudentFacility.md](src/api/student/student-facility/docStudentFacility.md)
- Fee Details: [src/api/fee-payment/feedetails/docFeedetails.md](src/api/fee-payment/feedetails/docFeedetails.md)
- Fee Demand: [src/api/fee-payment/fee-demand/docFeeDemand.md](src/api/fee-payment/fee-demand/docFeeDemand.md)
- Fee Payment: [src/api/fee-payment/payments/docFeePayments.md](src/api/fee-payment/payments/docFeePayments.md)
- Fee Acknowledgement: [src/api/fee-payment/acknoledgement/docAcknoledgement.md](src/api/fee-payment/acknoledgement/docAcknoledgement.md)
- Receipt Recall: [src/api/fee-payment/receipt-recall/docReceiptRecall.md](src/api/fee-payment/receipt-recall/docReceiptRecall.md)
- Refund: [src/api/fee-payment/refund/doc.refund.md](src/api/fee-payment/refund/doc.refund.md)
- Reports: [src/api/fee-payment/reports/docReport.md](src/api/fee-payment/reports/docReport.md)
- Student Fee Tracking: [src/api/fee-payment/student-fee-tracking/docStudentFeeTracking.md](src/api/fee-payment/student-fee-tracking/docStudentFeeTracking.md)

## Postman

Use the files in src/postman:

- [src/postman/qpulseFinanceApi.postman_collection.json](src/postman/qpulseFinanceApi.postman_collection.json)
- [src/postman/qpulseFinanceLocal.postman_environment.json](src/postman/qpulseFinanceLocal.postman_environment.json)
- [src/postman/postmanQuickStartGuide.md](src/postman/postmanQuickStartGuide.md)
