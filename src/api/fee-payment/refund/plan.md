Refund API — Final Plan (Correct)

The Refund API allows an authorized admin to process refunds for a student by deducting the refunded amount from the corresponding paid (NET) value in the StudentFeeTracking ledger while recording the refund as a separate immutable transaction. The API accepts rollNo, academicYear, feeHead, and refundAmount as mandatory inputs. For academic fee heads (tuition, exam, erp, book, lab), semNumber is required to identify the correct semester (odd/even mapping). The system validates that the refund amount is strictly greater than zero and less than or equal to the current paid amount of the targeted component, preventing over-refund and negative values.

Upon successful validation, the system updates the ledger using:

updatedPaid = max(0, previousPaid - refundAmount)

Only the paid field is modified; total and concessions remain unchanged. Following this, all dependent aggregates are recalculated hierarchically (component → semester → academic year → overall), and the status field is recomputed as Paid, Partial, or Unpaid based on updated values, ensuring consistency with the fee tracking rules .

Simultaneously, a separate refund transaction record is created in the refund module, containing details such as rollNo, academicYear, semesterNumber (if applicable), feeHead, refundAmount, reason, refundReceiptNo, and refundedBy. This record is immutable and ensures a complete audit trail without modifying original payment transactions.

For feeHead = excessAmount, the refund is deducted from the student's available excess balance with validation ensuring:

refundAmount ≤ currentExcessAmount

and updated using:

updatedExcess = max(0, currentExcess - refundAmount)

The operation must be treated as atomic, ensuring that both ledger update and refund transaction creation succeed together; otherwise, no changes are persisted. A final validation check must be performed before update to avoid race conditions (e.g., concurrent refunds). The API strictly enforces that no values in the system become negative and that all updates respect the defined academic hierarchy (Batch → Academic Year → Semester → Fee Head) .