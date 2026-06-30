// Self-verification script — mirrors the exact formulas in page.tsx

const UNIT_CONFIGS = {
  shop: {
    label: "Shop - Ground Floor",
    loadingFactor: 0.07,
    roundZ: true,
    aaDivisor: 0.12,
    gstRate: 0.12,
    abRate: 0.01,
    acRate: 0.20,
    adRate: 0.099,
    aeRate: 0.101,
    akRate: 0.20,
    aoRate: 0.06,
  },
  office: {
    label: "Office - 3rd Floor",
    loadingFactor: 0.13,
    roundZ: false,
    aaDivisor: 0.18,
    gstRate: 0.18,
    abRate: 0.01,
    acRate: 0.20,
    adRate: 0.099,
    aeRate: 0.101,
    akRate: 0.20,
    aoRate: 0.06,
  },
};

function roundNearest(value, nearest) {
  return Math.round(value / nearest) * nearest;
}

function ceiling(value, significance) {
  return Math.ceil(value / significance) * significance;
}

function calculate(H, X, unitType, AP = 30000) {
  const cfg = UNIT_CONFIGS[unitType];
  const Y = X * (1 + cfg.loadingFactor);
  const ZRaw = H * Y;
  const Z = cfg.roundZ ? roundNearest(ZRaw, 100) : ZRaw;
  const AA = Z / (1 + cfg.aaDivisor);
  const AB = Math.round(AA * cfg.abRate);
  const AC = AB * cfg.acRate;
  const AD = AA * cfg.adRate;
  const AE = AA * cfg.aeRate;
  const AJ = AA * cfg.gstRate;
  const AK = AJ * cfg.akRate;
  const AO = AA * cfg.aoRate;
  const AQ = AO + AP;
  const AR = ceiling(AQ, 100);
  return { H, X, Y, Z, AA, AB, AC, AD, AE, AJ, AK, AO, AP, AQ, AR };
}

function fmt(v) {
  return v.toLocaleString("en-IN", { maximumFractionDigits: 4 });
}

function printResult(label, r) {
  console.log(`\n${"─".repeat(55)}`);
  console.log(`TEST: ${label}`);
  console.log(`${"─".repeat(55)}`);
  console.log(`  H  (Unit Area Sq.Ft.)        = ${fmt(r.H)}`);
  console.log(`  X  (Rate PSF)                = ${fmt(r.X)}`);
  console.log(`  Y  (Loaded Rate)             = ${fmt(r.Y)}`);
  console.log(`  Z  (Total Value)             = ${fmt(r.Z)}`);
  console.log(`  AA (Agreement Value)         = ${fmt(r.AA)}`);
  console.log(`  AB (TDS 1%)                  = ${fmt(r.AB)}`);
  console.log(`  AC (TDS Due 20%)             = ${fmt(r.AC)}`);
  console.log(`  AD (Due 9.9%)                = ${fmt(r.AD)}`);
  console.log(`  AE (Due 10.10%)              = ${fmt(r.AE)}`);
  console.log(`  AJ (Total GST)               = ${fmt(r.AJ)}`);
  console.log(`  AK (GST Due Milestone 20%)   = ${fmt(r.AK)}`);
  console.log(`  AO (Stamp Duty 6%)           = ${fmt(r.AO)}`);
  console.log(`  AP (Registration Charges)    = ${fmt(r.AP)}`);
  console.log(`  AQ (Total Stamp + Reg)       = ${fmt(r.AQ)}`);
  console.log(`  AR (CEILING to 100)          = ${fmt(r.AR)}`);
}

// Test 1: Shop H=500, X=20000
const t1 = calculate(500, 20000, "shop", 30000);
printResult("Shop  — H=500, X=₹20,000, AP=₹30,000", t1);

// Test 2: Office H=800, X=15000
const t2 = calculate(800, 15000, "office", 30000);
printResult("Office — H=800, X=₹15,000, AP=₹30,000", t2);

console.log(`\n${"─".repeat(55)}`);
console.log("Self-verification complete.");
