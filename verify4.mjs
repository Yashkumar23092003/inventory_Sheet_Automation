// Verify Option A: sqm input → H_sqft = ROUND(sqm × 10.764, 2)
const sqm = 41.84;
const CONV = 10.764;
const H_sqft = Math.round(sqm * CONV * 100) / 100;  // ROUND to 2dp

const X = 28000;
const Y = X * 1.07;        // Shop loading
const Z = H_sqft * Y;      // No round-to-100 on Z
const AA = Z / 1.12;
const AB = Math.round(AA * 0.01);
const AC = Math.round(AB * 0.20);
const AD = AA * 0.099;
const AE = AA * 0.101;
const AJ = AA * 0.12;
const AK = AJ * 0.20;

console.log(`sqm=41.84 × 10.764 = ${sqm * CONV} → ROUND to 2dp = ${H_sqft} sqft`);
console.log(`Y  = ${Y}         | Excel: 29960     | ${Y === 29960 ? "✅" : "❌"}`);
console.log(`Z  = ${Z.toFixed(2)}   | Excel: 13493085  | ${Math.abs(Z - 13493085) < 1 ? "✅" : "❌"}`);
console.log(`AA = ${AA.toFixed(4)}  | Excel: 12047398  | ${Math.round(AA) === 12047398 ? "✅" : "❌"}`);
console.log(`AB = ${AB}          | Excel: 120474    | ${AB === 120474 ? "✅" : "❌"}`);
console.log(`AC = ${AC}          | Excel: 24095     | ${AC === 24095 ? "✅" : "❌"}`);
console.log(`AD = ${Math.round(AD)}        | Excel: 1192692   | ${Math.round(AD) === 1192692 ? "✅" : "❌"}`);
console.log(`AE = ${Math.round(AE)}        | Excel: 1216787   | ${Math.round(AE) === 1216787 ? "✅" : "❌"}`);
console.log(`AJ = ${Math.round(AJ)}        | Excel: 1445688   | ${Math.round(AJ) === 1445688 ? "✅" : "❌"}`);
console.log(`AK = ${Math.round(AK)}         | Excel: 289138    | ${Math.round(AK) === 289138 ? "✅" : "❌"}`);
