How Yearly Concession Is Split Into Odd & Even Semesters
The logic lives in 

utils.students.js
 inside 

generateLedger
, lines 215–243.

Step 1 — Collect the yearly concession per category

calculateComponentConcessions()
 (line 52) sums all applicable enrollment schemes (firstGraduate, scheme7point5, pmss, sakthi, specialConcession) to produce a single yearly concession amount per category (tuition, exam, erp, book, lab, transport, hostel).

For example: concessions.tuition = 5000 (total for the full year).

Step 2 — Calculate the proportional split ratio
js
const oddGross  = oddLedger.subTotal;   // raw gross fee of odd sem
const evenGross = evenLedger.subTotal;  // raw gross fee of even sem
const grossSum  = oddGross + evenGross; // total gross for the year
const oddRatio  = grossSum > 0 ? oddGross / grossSum : 0;
The odd semester gets a share proportional to its gross fee weight relative to the full year's gross. If odd and even sems have equal fees, the ratio is 0.5 / 0.5.

Step 3 — Apply split per category
js
ACADEMIC_FIELDS.forEach((field) => {            // tuition, exam, erp, book, lab
  const totalConc = concessions[field];         // yearly amount
  const oddShare  = totalConc * oddRatio;       // proportional share → odd
  const evenShare = totalConc - oddShare;       // remainder → even
  oddLedger[field].total  -= oddShare;          // net = gross - concession
  evenLedger[field].total -= evenShare;
});
After subtraction, subTotals and totals are recalculated on both semesters.

Summary Table
Step	What happens

calculateComponentConcessions()
Sums all schemes → one yearly amount per category
oddRatio = oddGross / grossSum	Determines how much % the odd sem "weighs"
oddShare = totalConc × oddRatio	Odd sem's share of the yearly concession
evenShare = totalConc − oddShare	Even sem gets the remainder (avoids rounding loss)
Net totals updated	Each semester's field.total = gross − share, floored at 0
Transport & Hostel are not split — they are per-year fees applied once (fee - concessions.transport/hostel), not distributed across semesters.

