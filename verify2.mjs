// Cross-check against the Excel test values from the screenshot
// Rate PSF (X) = 28000, Unit type = Shop (loading 7%, GST 12%)
// H is back-calculated from Z shown in Excel

const X = 28000;
const loadingFactor = 0.07;
const aaDivisor = 0.12;
const gstRate = 0.12;

const Y = X * (1 + loadingFactor);
console.log(`Y (Actual PSF)       = ${Y}       | Excel: 29960      | ${Y === 29960 ? "✅ MATCH" : "❌ MISMATCH"}`);

// Excel shows "Actual Agreement value (before divisor)" = 13493085 → this is Z
const Z_excel = 13493085;
// Back-calculate H
const H_backCalc = Z_excel / Y;
console.log(`H (back-calc)        = ${H_backCalc.toFixed(4)} (not given in image)`);
console.log(`Z (from Excel)       = ${Z_excel}  | Note: NOT a multiple of 100 — roundZ may not apply here`);

const AA_excel = 12047398;
const AA_fromZ  = Z_excel / (1 + aaDivisor);
console.log(`\nAA from Z_excel/1.12 = ${AA_fromZ.toFixed(4)}`);
console.log(`AA (Excel)           = ${AA_excel}  | Diff: ${(AA_fromZ - AA_excel).toFixed(4)}`);

// Use AA_excel as source of truth (as Excel stores it) for downstream checks
const AA = AA_excel;

const AB = Math.round(AA * 0.01);
console.log(`\nAB ROUND(AA×1%,0)    = ${AB}      | Excel: 120474     | ${AB === 120474 ? "✅ MATCH" : "❌ MISMATCH"}`);

const AC_raw = AB * 0.20;
const AC_rounded = Math.round(AC_raw);
console.log(`AC AB×20%            = ${AC_raw}    | Excel: 24095      | raw=${AC_raw} rounded=${AC_rounded} → ${AC_rounded === 24095 ? "✅ MATCH (with ROUND)" : "⚠️  need to verify"}`);

const AD = AA * 0.099;
console.log(`AD AA×9.9%           = ${AD.toFixed(2)} | Excel: 1192692   | ${Math.round(AD) === 1192692 ? "✅ MATCH" : "❌"}`);

const AE = AA * 0.101;
console.log(`AE AA×10.1%          = ${AE.toFixed(2)} | Excel: 1216787   | ${Math.round(AE) === 1216787 ? "✅ MATCH" : "❌"}`);

const AJ = AA * gstRate;
console.log(`AJ AA×12%            = ${AJ.toFixed(2)} | Excel: 1445688   | ${Math.round(AJ) === 1445688 ? "✅ MATCH" : "❌"}`);

const AK = AJ * 0.20;
console.log(`AK AJ×20%            = ${AK.toFixed(2)}  | Excel: 289138    | ${Math.round(AK) === 289138 ? "✅ MATCH" : "❌"}`);

// "Balance (100%)" = AA - Amount Received = 12047398 - 100000 = 11947398
const balance100 = AA - 100000;
console.log(`\nBalance(100%) AA-Recd= ${balance100}   | Excel: 11947398  | ${balance100 === 11947398 ? "✅ MATCH" : "❌"}`);

console.log(`\n--- SUMMARY ---`);
console.log(`AC discrepancy: raw=${AC_raw}, Excel=24095`);
console.log(`If Excel uses ROUND(AB×0.20, 0): ${Math.round(AC_raw)} → ${Math.round(AC_raw) === 24095 ? "matches ✅" : "still off ❌"}`);
