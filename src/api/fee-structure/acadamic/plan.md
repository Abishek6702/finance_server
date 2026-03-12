# Plan for Fee Structure Update

## Issue 1: Overwriting Existing Departments/Structures on Update
**Problem**: 
Currently, the `updateFeeStructure` function in `serviceAcadamic.js` uses `findOneAndUpdate({ academicYear }, data)` which blindly replaces the entire `academicStructures` array with the payload provided. If you provide an edit for the `IT` department when `CSE` already exists, `CSE` is deleted.

**Solution**:
1. Change the `updateFeeStructure` logic to fetch the existing `FeeStructureMaster` document first.
2. Implement a **Deep Merge Mechanism**:
   - Iterate over the incoming `academicStructures` payload.
   - For each structure, find the matching one in the database by `quota`, `educationType`, and `degreeProgram`.
   - If it exists, iterate through its `departments`. Match the existing department by `departmentName`.
   - If the department exists, iterate through its `semesters`. Match the existing semester by `semesterNumber`.
   - Identify the specific fee components provided in the payload (e.g., `exam` fee) and update **only** those components, leaving other fees (like `tuition`, `erp`) and other departments intact.
   - If a structure, department, or semester doesn't exist, push it to the respective array.
3. Save the deeply merged document. This prevents any existing data from being accidentally deleted during a partial update.

## Issue 2: Propagating Fee Changes to Student Tracking Records
**Problem**:
The user requirement is: "Updating a fee (e.g., 2025-2026 UG CSE SEM 2 exam fee +200) needs to update the student tracking records only for those who have that same 2025-2026 UG CSE SEM 2. The total, subtotal, and status need to be updated according to paid."

**Current State & Solution**:
1. The `propagateFeeStructureUpdate` function already successfully identifies the exact students taking that specific semester in that specific academic year using `studyYear = year - batch` and checking `oddSemNo` / `evenSemNo`.
2. It already correctly pushes the new fee amount (e.g., `exam` fee) into the student's `subTotal` for that academic component.
3. The real reason this might appear broken currently is **Issue 1**. Because the entire department gets deleted during an update, `propagateFeeStructureUpdate` cannot find the updated department data to propagate!
4. Furthermore, the `modelStudentFeeTracking.js` pre-save hook handles the total, paid, and status calculations flawlessly:
   - `subTotal` is recalculated based on individual fee components.
   - `total` (net amount) is calculated as `subTotal - concession`.
   - `paid` is bounded by `Math.min(paid, total)`.
   - `status` is automatically recalculated to "Paid", "Partial", or "Unpaid" based on `paid` vs `total`.

**Action Items**:
- Once the **Deep Merge Mechanism** is implemented in `serviceAcadamic.js`, `propagateFeeStructureUpdate` will automatically work as expected because the `StudentFeeTracking` pre-save hook inherently handles all status and total derivations.
- We will double-check that `propagateFeeStructureUpdate` accurately carries over the individual component updates (like only `exam`) without accidentally zeroing out unspecified components. Ensure it reads from the *deeply merged* `FeeStructureMaster` document before saving the `StudentFeeTracking` models.
