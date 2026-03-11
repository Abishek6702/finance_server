Student Facility Management
The Student Facility Management module handles the assignment and transfer of hostel and transport facilities for students. It allows administrators to allocate hostel accommodation or transport services to students and manage changes when a student moves between facilities.

This module supports transferring a student from hostel to transport, transport to hostel, one transport route to another transport route, and one hostel to another hostel. It ensures that all facility movements are properly recorded and updated in the system.

The module helps maintain accurate records of student facility allocations and transfers, making it easier for administrators to manage hostel accommodations and transport services efficiently.

no change in any scheme or any other apis

this is building new api and updating the values in the db alone 

isolated api

this api will work on student (read,write) , hostal(read)  , transport(read)  and studentfeetraking(read,write) collections alone 

on facility change
the request need to have two things 
new fecility info
applyFromAcadamicYear [this need to be this current acad year or future acad year  of the student if the traking sheet dont have that acad year then skip updation for those]
from this applyFromAcadamicYear to 8 sem update all possible

 it need to updated in that student table and then that student's fee traking collection need to be updated by refering the fee form that perticular hostal or transport collection 

 example if a student of 2025-2026 have bus and
 that student join hostal same year then 





 PUT StudentFacility/:rollNo
 {
    transport:{
        isApplicable:false
    },
    hostel:{
        isApplicable:true,
        block:B,
        sharing:4,
        isAttached:false,
    },
    applyFromAcadamicYear:2025-2026
 }






also one can move from hsotel to hostel , trsnport to transport that need to make the update, also hostel or transport to both false 
 [edge case if this year student paid transport fee then moving to hostal this year dont allow that change request only if unpaid make that applicable false and make change dont allow for any paid or partial]

 only one api allow for admin and super admin 


 Further Considerations

Transport request field name: the student creation API uses stopName in the request. Should this module use the same stopName field, or stop? Recommendation: use stopName for consistency with existing student API.

applyFromAcademicYear outside batch end: should we silently succeed (no tracking years updated) or return 400? Recommendation: 400 — likely a data entry mistake.
Both transport and hostel false, student has neither: currently would be a no-op update. Should this be allowed (silently success) or rejected as "nothing to change"? Recommendation: allow, return 200 with a note.



Plan: Student Facility Management — New Module (FINAL)
TL;DR: New isolated StudentFacility module. Single PUT /api/studentFacility/:rollNo endpoint. Assigns/transfers/removes hostel and transport. Updates StudentFeeTracking year records first (from applyFromAcademicYear through batch end), then updates the Student document — only if the operation is positive (not blocked by guards). Pre-save hook on tracking recalculates all NET totals automatically.

Request Shape
transport.isApplicable: true requires route (String) + stopName (String)
hostel.isApplicable: true requires block, sharing, isAttached
At least one of transport / hostel must be in body
Auth: protect + admin (covers both admin and superadmin roles)
Steps
Phase 1 — Validate (validation layer)

applyFromAcademicYear required, must match YYYY-YYYY
At least one of transport/hostel must be present
If hostel.isApplicable: true → block, sharing, isAttached required
If transport.isApplicable: true → route, stopName required
Phase 2 — Fetch & Guard (service layer)
5. Student.findOne({ "personal.rollNo": rollNo }) → 404 if missing
6. applyFromAcademicYear start ≥ student.academic.currentAcademicYear start → else 400 "applyFromAcademicYear cannot be before the student's current academic year"
7. applyFromAcademicYear start < batchEndYear → else 400 "applyFromAcademicYear must be within the student's batch range (batch: YYYY-YYYY)"
8. If hostel.isApplicable: true → Hostel.findOne({ block, sharing, isAttached }) → 404
9. If transport.isApplicable: true → Transport.findOne({ route, stop: stopName }) → 404

Phase 3 — Paid/Partial Guard
10. Load StudentFeeTracking by rollNo (no tracking = skip guard)
11. Find year record for applyFromAcademicYear
12. If transport in body + year record exists + yearRecord.transport?.total?.status is "Paid" or "Partial" → 409 "Cannot change transport: transport fee for YYYY-YYYY is already Paid/Partial"
13. Same for hostel

Phase 4 — Build Target Years
14. targetYears = all years from applyFromAcademicYear through (batchEndYear-1)-(batchEndYear) inclusive

Phase 5 — Update StudentFeeTracking (for each target year that EXISTS in tracking — skip missing silently)
15. If transport in body:
- isApplicable: false → yearRecord.transport = undefined
- isApplicable: true → yearRecord.transport = { transport: resolvedId, route, busNo, stop, fee, subTotal: fee, total: { total: 0 } } — hook recalculates NET
16. Same for hostel (hostelSpecialConcession: 0, hostelSpecialConcession field preserved from existing if already set)
17. tracking.markModified("academicYearWiseRecord") + await tracking.save()

Phase 6 — Update Student Document (always happens if we reach here — positive case)
18. transport in body → overwrite student.transport with { isApplicable: false } or full resolved object
19. Same for hostel; await student.save()
20. Return 200 with updated student + updatedYearsCount

Note: "Both to false, neither applicable" is a valid operation — returns 200 with "No active facility changes to apply to fee tracking, student profile updated" message.

Key Architecture Notes
No model file — reads/writes existing collections only
Hook does all math — only subTotal = fee needs to be set; pre-save hook on StudentFeeTracking computes total.total = subTotal - concessions.transport automatically, re-sums year totals, preserves paid and status
Concessions untouched — yearRecord.concessions block is never modified
Stale field prevention — clearing a facility sets student.transport = { isApplicable: false } (no leftovers)
Order matters — tracking saved before student; student update only if tracking save succeeds
Files
New (create):

src/api/StudentFacility/controller.StudentFacility.js
src/api/StudentFacility/service.StudentFacility.js
src/api/StudentFacility/validation.StudentFacility.js
src/api/StudentFacility/routes.StudentFacility.js
src/test/StudentFacility.test.js
Existing (modify):

server.js — require + app.use("/api/studentFacility", sfmRoutes) after existing routes
doc.StudentFacility.md — fill endpoint documentation
Untouched: all other modules, models, existing tests

Test Plan (20 cases)
#	Scenario	Expected
1	No token	401
2	Missing applyFromAcademicYear	400
3	Invalid applyFromAcademicYear format	400
4	Neither transport nor hostel in body	400
5	hostel.isApplicable: true, missing block	400
6	transport.isApplicable: true, missing stopName	400
7	Student not found	404
8	applyFromAcademicYear before currentAcademicYear	400 + clear message
9	applyFromAcademicYear after batch end year	400 + clear message
10	Hostel config not in master	404
11	Transport stop/route not in master	404
12	Success: assign transport (was none)	200, student + tracking updated
13	Success: transport → hostel	200, transport cleared, hostel added
14	Success: hostel → transport	200
15	Success: hostel → different hostel	200, new fee reflected in tracking
16	Success: transport → different stop	200
17	Success: set transport to false, hostel untouched	200
18	Success: both false, neither was applicable	200 + note
19	409 guard: transport is Partial in applyFromAcademicYear	409
20	409 guard: hostel is Paid in applyFromAcademicYear	409
Verification
npm test — all existing + new tests pass
After update: student.transport/student.hostel reflect new state; StudentFeeTracking year records show correct subTotal, total.total = subTotal - concession, total.paid untouched