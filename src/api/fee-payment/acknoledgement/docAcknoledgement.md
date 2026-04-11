# Fee Acknowledgement API

Base path: /api/feeAcknowledgement

All routes require Authorization bearer token and admin access.

## Endpoints

Legacy endpoints:
- POST /api/feeAcknowledgement/
- PUT /api/feeAcknowledgement/
- GET /api/feeAcknowledgement/
- GET /api/feeAcknowledgement/:id

V2 endpoints:
- POST /api/feeAcknowledgement/v2
- GET /api/feeAcknowledgement/v2
- GET /api/feeAcknowledgement/v2/:id
- PUT /api/feeAcknowledgement/v2

## Legacy Flow

### POST /

Creates an acknowledgement entry for a student payment intent.

Required fields:
- rollNo
- paymentType: Cash, Card, UPI, NetBanking, Cheque, DD, excessAmount, reduction
- breakdowns: non-empty array

Conditional fields:
- reductionId is required when paymentType is reduction
- academic.semesterNumber required when academic fee heads are provided

### PUT /

Updates acknowledgement status.

Required fields:
- rollNo
- receiptNo
- status: SUCCESSFUL or REJECTED

### GET /

Lists acknowledgement records.

### GET /:id

Fetches one acknowledgement by id.

## V2 Flow

### POST /v2

Creates a lightweight acknowledgement record.

Required fields:
- rollNo
- paymentType
- totalAmount

Optional fields:
- bankName
- date
- message

### PUT /v2

Updates V2 acknowledgement decision.

Required fields:
- rollNo
- ackId
- status: approved or rejected

Optional field:
- message

### GET /v2

Lists V2 acknowledgement records.

### GET /v2/:id

Fetches one V2 acknowledgement by ack id.

## Response Shape

Success:

```json
{
  "success": true,
  "data": {},
  "message": "Acknowledgment ..."
}
```

Error:

```json
{
  "success": false,
  "message": "Validation or processing error"
}
```
