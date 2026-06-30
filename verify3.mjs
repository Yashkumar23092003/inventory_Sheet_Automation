// Full verify: H=450 sqft, X=28000, Shop type
const H = 450;
const X = 28000;
const Y = X * 1.07;
const ZRaw = H * Y;
const Z_rounded = Math.round(ZRaw / 100) * 100;  // ROUND to nearest 100

const AA_fromRounded  = Z_rounded / 1.12;
const AA_fromUnrounded = ZRaw / 1.12;

console.log("── H=450, X=28000, Shop ──────────────────────────");
console.log(`Y = ${Y}               | Excel: 29960       | ${Y === 29960 ? "✅" : "❌"}`);
console.log(`Z (raw H×Y)     = ${ZRaw.toLocaleString("en-IN")}    | Excel Z col: 13,493,085`);
console.log(`Z (rounded 100) = ${Z_rounded.toLocaleString("en-IN")}    | is multiple of 100: ${Z_rounded % 100 === 0}`);
console.log(`AA from rounded Z = ${AA_fromRounded.toFixed(2)}   | Excel AA: 12,047,398`);
console.log(`AA from raw Z     = ${AA_fromUnrounded.toFixed(2)}   | Excel AA: 12,047,398`);
console.log("");
console.log("── The displayed '450 sqft' in Excel may be ROUNDED from sqm conversion ──");
// Try: if Excel uses 41.84 sqm × 10.764 = 450.35 sqft (not rounded)
const H_sqm = 41.84;
const conv = 10.764;
const H_actual = H_sqm * conv;
console.log(`H from sqm: 41.84 × 10.764 = ${H_actual.toFixed(4)} sqft`);
const Z_sqm = H_actual * Y;
const AA_sqm = Z_sqm / 1.12;
console.log(`Z = ${H_actual.toFixed(4)} × ${Y} = ${Z_sqm.toFixed(2)}`);
console.log(`AA = Z/1.12 = ${AA_sqm.toFixed(2)} | Excel: 12,047,398`);
console.log("");

// Try RERA factor: 10.7639
const H_rera = H_sqm * 10.7639;
const Z_rera = H_rera * Y;
const AA_rera = Z_rera / 1.12;
console.log(`H (RERA 10.7639): 41.84 × 10.7639 = ${H_rera.toFixed(4)} sqft`);
console.log(`Z = ${Z_rera.toFixed(2)} | AA = ${AA_rera.toFixed(2)} | Excel AA: 12,047,398`);
console.log("");

// Back-calculate what H gives Excel's AA exactly
const needed_Z = 12047398 * 1.12;
const needed_H = needed_Z / Y;
console.log(`── To get AA=12,047,398 exactly ───────────────────`);
console.log(`Needed Z = 12047398 × 1.12 = ${needed_Z.toFixed(2)}`);
console.log(`Needed H = ${needed_H.toFixed(4)} sqft`);
console.log(`Needed sqm (÷10.764) = ${(needed_H/10.764).toFixed(4)}`);
console.log(`Needed sqm (÷10.7639) = ${(needed_H/10.7639).toFixed(4)}`);
