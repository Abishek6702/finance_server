const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'postman', 'Qpulse_Finance_API.postman_collection.json');
const collection = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Find "Receipt Recall" -> "Get Recall History"
let receiptFolder = collection.item.find(i => i.name === 'Receipt Recall');
if (!receiptFolder) {
  receiptFolder = collection.item.find(i => i.name === 'Receipt Recall' || i.name.toLowerCase().includes('recall'));
}

if (receiptFolder && receiptFolder.item) {
  const getHistoryReq = receiptFolder.item.find(i => i.name === 'Get Recall History');
  if (getHistoryReq) {
    // Update queries
    getHistoryReq.request.url.query = [
      { key: "recallId", value: "", description: "Single popup mode: Fetch a specific recall record by ID", disabled: true },
      { key: "rollNo", value: "25CS101", disabled: true },
      { key: "receiptNo", value: "REC-20260303-001", disabled: true },
      { key: "search", value: "John", disabled: true },
      { key: "department", value: "CSE", disabled: true },
      { key: "year", value: "1", disabled: true },
      { key: "paymentMode", value: "CASH", disabled: true },
      { key: "feeHead", value: "exam", disabled: true },
      { key: "fromDate", value: "2026-03-01", disabled: true },
      { key: "toDate", value: "2026-03-31", disabled: true },
      { key: "page", value: "1", disabled: true },
      { key: "limit", value: "20", disabled: true },
    ];

    // Read the examples to update them
    getHistoryReq.response = [];

    // Table Mode Example
    getHistoryReq.response.push({
      name: "Table Mode (All records)",
      originalRequest: {
        method: "GET",
        header: [
          { key: "Authorization", value: "Bearer {{admin_token}}" }
        ],
        url: {
          raw: "{{base_url}}/api/receiptRecall?page=1&limit=20",
          host: ["{{base_url}}"],
          path: ["api", "receiptRecall"],
          query: [
            { key: "page", value: "1" },
            { key: "limit", value: "20" }
          ]
        }
      },
      status: "OK",
      code: 200,
      _postman_previewlanguage: "json",
      header: [{ key: "Content-Type", value: "application/json" }],
      body: JSON.stringify({
        success: true,
        message: "Recall records fetched successfully",
        data: {
          records: [
            {
              studentPhoto: "photo.jpg",
              studentName: "John Doe",
              year: 1,
              semester: 1,
              department: "CSE",
              rollNo: "25CS101",
              academicYear: "2025-2026",
              feeHead: "exam",
              amount: 1500,
              raisedOn: "2026-03-07T10:30:00.000Z",
              paymentMode: "CASH",
              bank: null,
              receiptNo: "REC-20260303-001",
              recallId: "67c9a1b2e4f5a60012345678"
            }
          ],
          pagination: {
            total: 42,
            page: 1,
            limit: 20,
            totalPages: 3
          }
        }
      }, null, 2)
    });

    // Single Popup Mode Example
    getHistoryReq.response.push({
      name: "Single Popup Mode",
      originalRequest: {
        method: "GET",
        header: [
          { key: "Authorization", value: "Bearer {{admin_token}}" }
        ],
        url: {
          raw: "{{base_url}}/api/receiptRecall?recallId=67c9a1b2e4f5a60012345678",
          host: ["{{base_url}}"],
          path: ["api", "receiptRecall"],
          query: [
            { key: "recallId", value: "67c9a1b2e4f5a60012345678" }
          ]
        }
      },
      status: "OK",
      code: 200,
      _postman_previewlanguage: "json",
      header: [{ key: "Content-Type", value: "application/json" }],
      body: JSON.stringify({
        success: true,
        message: "Recall fetched successfully",
        data: {
          recall: {
            studentPhoto: "photo.jpg",
            studentName: "John Doe",
            year: 1,
            semester: 1,
            department: "CSE",
            rollNo: "25CS101",
            academicYear: "2025-2026",
            feeHead: "exam",
            amount: 1500,
            raisedOn: "2026-03-07T10:30:00.000Z",
            paymentMode: "CASH",
            bank: null,
            receiptNo: "REC-20260303-001",
            reason: "Wrong semester selected"
          }
        }
      }, null, 2)
    });

    console.log("Updated Get Recall History request successfully.");
  } else {
    console.log("Could not find Get Recall History");
  }
} else {
  console.log("Could not find Receipt Recall folder");
}

fs.writeFileSync(filePath, JSON.stringify(collection, null, 2), 'utf8');
console.log('Collection saved.');
