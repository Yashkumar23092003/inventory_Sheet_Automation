"use client";

import { useState, useMemo } from "react";
import ApplicantExtractor from "./components/ApplicantExtractor";
import type { ApplicantData } from "./api/extract/route";

const SQM_TO_SQFT = 10.764; // fixed conversion factor

// ─── Per-type configs — fully independent, never cross-referenced ─────────────
const UNIT_CONFIGS = {
  shop: {
    label: "Shop - Ground Floor",
    loadingFactor: 0.07,   // Y = X * 1.07
    aaDivisor: 0.12,
    divisorCents: 112,      // (1 + 0.12) * 100 as exact integer — avoids float drift in AA
    gstRate: 0.12,          // AJ = AA * 12%
    abRate: 0.01,
    acRate: 0.20,
    adRate: 0.099,
    aeRate: 0.101,
    akRate: 0.20,
    aoRate: 0.06,
  },
  office: {
    label: "Office - 3rd Floor",
    loadingFactor: 0.13,   // Y = X * 1.13
    aaDivisor: 0.18,
    divisorCents: 118,      // (1 + 0.18) * 100 as exact integer — avoids float drift in AA
    gstRate: 0.18,          // AJ = AA * 18%
    abRate: 0.01,
    acRate: 0.20,
    adRate: 0.099,
    aeRate: 0.101,
    akRate: 0.20,
    aoRate: 0.06,
  },
} as const;

type UnitType = keyof typeof UNIT_CONFIGS;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** sqm → sqft: multiply by 10.764, round to 2 decimal places */
function sqmToSqft(sqm: number): number {
  return Math.round(sqm * SQM_TO_SQFT * 100) / 100;
}

/** Excel CEILING — always rounds UP to next multiple of `significance` */
function ceiling(value: number, significance: number): number {
  return Math.ceil(value / significance) * significance;
}

/** Indian rupee format, rounded to the nearest whole rupee: ₹ X,XX,XX,XXX */
function inr(value: number): string {
  if (!isFinite(value)) return "–";
  const intPart = Math.abs(Math.round(value)).toString();
  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const formatted =
    rest.length > 0
      ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
      : lastThree;
  return `₹ ${formatted}`;
}

/** Round to the nearest whole rupee (for the sheet payload). */
function r(n: number): number {
  return Math.round(n);
}

function fmt2(n: number): string {
  return n.toFixed(2);
}

// ─── Core calculation ─────────────────────────────────────────────────────────
interface CalcResult {
  H_sqm: number;
  H_sqft: number;
  X: number;
  Y: number;
  Z: number;
  AA: number;
  AB: number;
  AC: number;
  AD: number;
  AE: number;
  AF: number;
  AG: number;
  AH: number;
  AI: number;
  AJ: number;
  AK: number;
  AL: number;
  AM: number;
  AN: number;
  AO: number;
  AP: number;
  AQ: number;
  AR: number;
}

function calculate(
  unitSqm: number,
  balconySqm: number,
  X: number,
  unitType: UnitType,
  AP: number,
  AL: number,
  AF: number
): CalcResult {
  const cfg = UNIT_CONFIGS[unitType];

  const H_sqm = unitSqm + balconySqm;
  const H_sqft = sqmToSqft(H_sqm);           // ROUND(sqm × 10.764, 2)

  // Math.round prevents float drift (e.g. 28000 * 1.13 = 31639.9999... in IEEE 754)
  const Y = Math.round(X * (1 + cfg.loadingFactor));
  // H_cents × Y are both exact integers after rounding, so Z_scaled is exact.
  // cfg.divisorCents is stored as a literal integer (112 / 118) so the division
  // lands on an exact .5 and Math.round gives the correct AA every time.
  const H_cents = Math.round(H_sqft * 100);
  const Z_scaled = H_cents * Y;
  const Z = Z_scaled / 100;
  const AA = Math.round(Z_scaled / cfg.divisorCents);
  const AB = Math.round(AA * cfg.abRate);     // ROUND(AA×1%, 0)
  const AC = Math.round(AB * cfg.acRate);     // ROUND(AB×20%, 0)
  const AD = AA * cfg.adRate;
  const AE = AA * cfg.aeRate;
  const AJ = AA * cfg.gstRate;
  const AK = Math.round(AJ * cfg.akRate);     // ROUND(AJ×20%, 0)
  const AO = Math.round(AA * cfg.aoRate);
  const AQ = AO + AP;
  const AR = ceiling(AQ, 100);

  // Milestone tracking columns (require AF = Amount Received Till Date as input)
  const AG = Math.round((AD + AE) - AF);  // Balance (As per Due) = ROUND(AD+AE-AF, 0)
  const AH = AG - AC;                      // Due Amount Excluding T.D.S = AG - AC
  const AI = AA - AF;                      // Balance (100%) = AA - AF
  const AM = AK - AL;                      // Balance (As per Due GST) = AK - AL
  const AN = AJ - AL;                      // Balance (As per 100% GST) = AJ - AL

  return { H_sqm, H_sqft, X, Y, Z, AA, AB, AC, AD, AE, AF, AG, AH, AI, AJ, AK, AL, AM, AN, AO, AP, AQ, AR };
}

// ─── Result row ───────────────────────────────────────────────────────────────
function ResultRow({
  code,
  label,
  value,
  formula,
  highlight = false,
  showZero = false,
}: {
  code: string;
  label: string;
  value: number;
  formula: string;
  highlight?: boolean;
  showZero?: boolean;
}) {
  const valid = isFinite(value);
  const isNeg = value < 0;
  const display = valid && (value !== 0 || showZero);
  return (
    <tr className={highlight ? "bg-blue-50" : "even:bg-gray-50"}>
      <td className="px-3 py-2 font-mono text-xs font-bold text-blue-700 whitespace-nowrap">
        {code}
      </td>
      <td className="px-3 py-2 text-sm text-gray-700">{label}</td>
      <td className={`px-3 py-2 text-sm font-semibold text-right whitespace-nowrap ${isNeg ? "text-red-600" : "text-gray-900"}`}>
        {display
          ? (isNeg ? `−${inr(Math.abs(value))}` : inr(value))
          : <span className="text-gray-400">–</span>}
      </td>
      <td className="px-3 py-2 text-xs text-gray-400 font-mono">{formula}</td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CostSheetCalculator() {
  const [applicants, setApplicants] = useState<ApplicantData[]>([]);
  const [appendStatus, setAppendStatus] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [appendMsg, setAppendMsg] = useState<string>("");

  // Manual fields
  const [emailId, setEmailId]               = useState<string>("");
  const [shareCertFrom, setShareCertFrom]   = useState<string>("");
  const [shareCertTo, setShareCertTo]       = useState<string>("");
  const [numShares, setNumShares]           = useState<string>("");
  const [parkingNo, setParkingNo]           = useState<string>("");
  const [parkingLevel, setParkingLevel]     = useState<string>("");
  const [parkingLength, setParkingLength]   = useState<string>("");
  const [parkingWidth, setParkingWidth]     = useState<string>("");
  const [parkingHeight, setParkingHeight]   = useState<string>("");
  const [nomineeDetails, setNomineeDetails] = useState<string>("");
  const [contactNo, setContactNo]           = useState<string>("");
  const [altContactNo, setAltContactNo]     = useState<string>("");

  const [unitNo, setUnitNo]           = useState<string>("");
  const [soldUnsold, setSoldUnsold]   = useState<string>("Sold");
  const [dateOfBooking, setDateOfBooking] = useState<string>("");
  const [unitSqm, setUnitSqm]         = useState<string>("");
  const [balconySqm, setBalconySqm]   = useState<string>("0");
  const [ratePSF, setRatePSF]         = useState<string>("");
  const [unitType, setUnitType]       = useState<UnitType>("shop");
  const [regCharges, setRegCharges]   = useState<string>("30000");
  const [amtReceived, setAmtReceived] = useState<string>("0");
  const [gstReceived, setGstReceived] = useState<string>("0");

  const uSqm = parseFloat(unitSqm)      || 0;
  const bSqm = parseFloat(balconySqm)   || 0;
  const X    = parseFloat(ratePSF)      || 0;
  const AP   = parseFloat(regCharges)   || 0;
  const AF   = parseFloat(amtReceived)  || 0;
  const AL   = parseFloat(gstReceived)  || 0;

  const result = useMemo(
    () => calculate(uSqm, bSqm, X, unitType, AP, AL, AF),
    [uSqm, bSqm, X, unitType, AP, AL, AF]
  );

  const cfg     = UNIT_CONFIGS[unitType];
  const gstPct  = `${cfg.gstRate * 100}%`;
  const loadPct = `${cfg.loadingFactor * 100}%`;
  const divPct  = `${cfg.aaDivisor * 100}%`;

  const parkingTotal =
    parkingLength && parkingWidth && parkingHeight
      ? (parseFloat(parkingLength) * parseFloat(parkingWidth) * parseFloat(parkingHeight)).toFixed(2)
      : "";

  async function appendToSheet() {
    setAppendStatus("loading");
    setAppendMsg("");
    try {
      const payload = {
        unitNo, unitType: cfg.label, soldUnsold, dateOfBooking,
        unitSqm: result.H_sqm, balconySqm: bSqm,
        totalSqm: result.H_sqm, totalSqft: result.H_sqft,
        address:    applicants.map(a => a.address).filter(Boolean).join(" / "),
        contactNo, altContactNo, emailId,
        applicant1: applicants[0]?.name ?? "",
        applicant2: applicants[1]?.name ?? "",
        applicant3: applicants[2]?.name ?? "",
        pan:    applicants.map(a => a.pan).filter(Boolean).join(" / "),
        aadhar: applicants.map(a => a.aadhar).filter(Boolean).join(" / "),
        // All monetary columns rounded to the nearest whole rupee for the sheet
        X: r(result.X), Y: r(result.Y), Z: r(result.Z),
        AA: r(result.AA), AB: r(result.AB), AC: r(result.AC),
        AD: r(result.AD), AE: r(result.AE), AF: r(result.AF),
        AG: r(result.AG), AH: r(result.AH), AI: r(result.AI),
        AJ: r(result.AJ), AK: r(result.AK), AL: r(result.AL),
        AM: r(result.AM), AN: r(result.AN), AO: r(result.AO),
        AP: r(result.AP), AQ: r(result.AQ), AR: r(result.AR),
        parkingNo, parkingLevel,
        parkingLength, parkingWidth, parkingHeight, parkingTotal,
        shareCertFrom, shareCertTo, numShares,
      };
      const res = await fetch("/api/append-row", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? `Server error ${res.status}`);
      }
      setAppendStatus("success");
      setAppendMsg("Row added to Google Sheet successfully.");
    } catch (e) {
      setAppendStatus("error");
      setAppendMsg(e instanceof Error ? e.message : "Failed to append.");
    }
  }

  const rows = [
    {
      code: "H",
      label: "Unit Area (Sq. Ft.)",
      value: result.H_sqft,
      formula: `ROUND(${fmt2(result.H_sqm)} sqm × 10.764, 2)`,
    },
    {
      code: "Y",
      label: "Loaded Rate (PSF)",
      value: result.Y,
      formula: `X × (1 + ${loadPct})`,
    },
    {
      code: "Z",
      label: "Total Value",
      value: result.Z,
      formula: `H × Y`,
    },
    {
      code: "AA",
      label: "Agreement Value",
      value: result.AA,
      formula: `Z ÷ (1 + ${divPct})`,
      highlight: true,
    },
    {
      code: "AB",
      label: "TDS @ 1%",
      value: result.AB,
      formula: `ROUND(AA × 1%, 0)`,
    },
    {
      code: "AC",
      label: "TDS Due @ 20%",
      value: result.AC,
      formula: `ROUND(AB × 20%, 0)`,
    },
    {
      code: "AD",
      label: "Due @ 9.9%",
      value: result.AD,
      formula: `AA × 9.9%`,
    },
    {
      code: "AE",
      label: "Due @ 10.10%",
      value: result.AE,
      formula: `AA × 10.10%`,
    },
    {
      code: "AF",
      label: "Amount Recd. Till Date",
      value: result.AF,
      formula: `User input`,
      showZero: true,
    },
    {
      code: "AG",
      label: "Balance (As per Due)",
      value: result.AG,
      formula: `ROUND(AD + AE − AF, 0)`,
      highlight: true,
    },
    {
      code: "AH",
      label: "Due Amount Excl. T.D.S",
      value: result.AH,
      formula: `AG − AC`,
    },
    {
      code: "AI",
      label: "Balance (100%)",
      value: result.AI,
      formula: `AA − AF`,
      highlight: true,
    },
    {
      code: "AJ",
      label: "Total GST",
      value: result.AJ,
      formula: `AA × ${gstPct}`,
      highlight: true,
    },
    {
      code: "AK",
      label: "GST Due Milestone @ 20%",
      value: result.AK,
      formula: `AJ × 20%`,
    },
    {
      code: "AL",
      label: "G.S.T. Recd. Till Date",
      value: result.AL,
      formula: `User input`,
      showZero: true,
    },
    {
      code: "AM",
      label: "Balance (As per Due)",
      value: result.AM,
      formula: `AK − AL`,
      highlight: true,
    },
    {
      code: "AN",
      label: "Balance (As per 100%)",
      value: result.AN,
      formula: `AJ − AL`,
      highlight: true,
    },
    {
      code: "AO",
      label: "Stamp Duty @ 6%",
      value: result.AO,
      formula: `AA × 6%`,
    },
    {
      code: "AP",
      label: "Registration Charges",
      value: result.AP,
      formula: `Fixed input (default ₹30,000)`,
    },
    {
      code: "AQ",
      label: "Total (Stamp + Reg)",
      value: result.AQ,
      formula: `AO + AP`,
    },
    {
      code: "AR",
      label: "Total Stamp Duty + Reg (Ceiling)",
      value: result.AR,
      formula: `CEILING(AQ, 100)  [always rounds UP]`,
      highlight: true,
    },
  ];

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Cost Sheet Calculator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Superb Altura — Real Estate Inventory Pricing Dashboard
        </p>
      </div>

      {/* Applicant Extractor */}
      <ApplicantExtractor applicants={applicants} onChange={setApplicants} />

      {/* Inputs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Inputs
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Unit No. */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Unit No.
            </label>
            <input
              type="text"
              value={unitNo}
              onChange={(e) => setUnitNo(e.target.value)}
              placeholder="e.g. G-12"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Unit Type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Unit Type
            </label>
            <select
              value={unitType}
              onChange={(e) => setUnitType(e.target.value as UnitType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {Object.entries(UNIT_CONFIGS).map(([key, c]) => (
                <option key={key} value={key}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Sold / Unsold */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Sold / Unsold
            </label>
            <select
              value={soldUnsold}
              onChange={(e) => setSoldUnsold(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="Sold">Sold</option>
              <option value="Unsold">Unsold</option>
            </select>
          </div>

          {/* Date of Booking */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Date of Booking
            </label>
            <input
              type="date"
              value={dateOfBooking}
              onChange={(e) => setDateOfBooking(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Unit Area sqm */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Unit Area (Sq. Mt.)
            </label>
            <input
              type="number"
              value={unitSqm}
              onChange={(e) => setUnitSqm(e.target.value)}
              placeholder="e.g. 41.84"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Balcony sqm */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Balcony Area (Sq. Mt.)
            </label>
            <input
              type="number"
              value={balconySqm}
              onChange={(e) => setBalconySqm(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Rate PSF */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              X — Rate PSF (₹)
            </label>
            <input
              type="number"
              value={ratePSF}
              onChange={(e) => setRatePSF(e.target.value)}
              placeholder="e.g. 28000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Registration Charges */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              AP — Registration Charges (₹)
            </label>
            <input
              type="number"
              value={regCharges}
              onChange={(e) => setRegCharges(e.target.value)}
              placeholder="30000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Amount Received Till Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              AF — Amount Recd. Till Date (₹)
            </label>
            <input
              type="number"
              value={amtReceived}
              onChange={(e) => setAmtReceived(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* GST Received */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              AL — G.S.T. Recd. Till Date (₹)
            </label>
            <input
              type="number"
              value={gstReceived}
              onChange={(e) => setGstReceived(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Derived sqft — read only */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              H — Total Area (Sq. Ft.) <span className="text-gray-400">[derived]</span>
            </label>
            <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 font-semibold">
              {result.H_sqft > 0
                ? `${result.H_sqft.toFixed(2)} sq ft`
                : <span className="text-gray-400 font-normal">–</span>}
            </div>
            {result.H_sqm > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">
                ROUND({fmt2(result.H_sqm)} × 10.764, 2)
              </p>
            )}
          </div>
        </div>

        {/* Active config badges */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-blue-100 text-blue-800 font-medium">
            Loading: +{loadPct}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-purple-100 text-purple-800 font-medium">
            GST: {gstPct}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-green-100 text-green-800 font-medium">
            AA Divisor: 1 + {divPct}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-orange-100 text-orange-800 font-medium">
            Conversion: 1 sqm = 10.764 sqft
          </span>
        </div>
      </div>

      {/* Additional Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Additional Details
        </h2>

        <div className="space-y-5">

          {/* Contact & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contact No.</label>
              <input
                type="tel"
                value={contactNo}
                onChange={(e) => setContactNo(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Alternate Contact No.</label>
              <input
                type="tel"
                value={altContactNo}
                onChange={(e) => setAltContactNo(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Applicant&apos;s Email ID</label>
              <input
                type="email"
                value={emailId}
                onChange={(e) => setEmailId(e.target.value)}
                placeholder="email@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Share Certificate */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Share Certificate</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Certificate No. From</label>
                <input
                  type="text"
                  value={shareCertFrom}
                  onChange={(e) => setShareCertFrom(e.target.value)}
                  placeholder="e.g. 001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Certificate No. To</label>
                <input
                  type="text"
                  value={shareCertTo}
                  onChange={(e) => setShareCertTo(e.target.value)}
                  placeholder="e.g. 010"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">No. of Shares Allotted</label>
                <input
                  type="number"
                  value={numShares}
                  onChange={(e) => setNumShares(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Car Parking */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Car Parking</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Parking No.</label>
                <input
                  type="text"
                  value={parkingNo}
                  onChange={(e) => setParkingNo(e.target.value)}
                  placeholder="e.g. P-12"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Basement Level</label>
                <input
                  type="text"
                  value={parkingLevel}
                  onChange={(e) => setParkingLevel(e.target.value)}
                  placeholder="e.g. B1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <p className="text-xs font-medium text-gray-500 mb-2">Measurements (metres)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Length (M)", val: parkingLength, set: setParkingLength },
                { label: "Width (M)",  val: parkingWidth,  set: setParkingWidth  },
                { label: "Height (M)", val: parkingHeight, set: setParkingHeight },
                {
                  label: "Total (M)",
                  val: (
                    parkingLength && parkingWidth && parkingHeight
                      ? (parseFloat(parkingLength) * parseFloat(parkingWidth) * parseFloat(parkingHeight)).toFixed(2)
                      : ""
                  ),
                  set: () => {},
                  readOnly: true,
                },
              ].map(({ label, val, set, readOnly }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    readOnly={readOnly}
                    placeholder="0.00"
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${readOnly ? "bg-gray-50 border-gray-200 text-gray-700 font-semibold" : "border-gray-300"}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Nominee */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Nominee (If Any)</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nominee Name &amp; Details</label>
              <textarea
                value={nomineeDetails}
                onChange={(e) => setNomineeDetails(e.target.value)}
                placeholder="Nominee full name, relation, contact (if any)"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

        </div>
      </div>

      {/* ── OUTPUT ───────────────────────────────────────────────── */}
      <div className="mb-2">
        <h2 className="text-base font-bold text-gray-800">Calculated Output</h2>
        <p className="text-xs text-gray-400">Live — updates as you type. All values in ₹.</p>
      </div>

      {/* Key metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {[
          { label: "Agreement Value", value: result.AA, color: "blue"   },
          { label: `Total GST (${gstPct})`,  value: result.AJ, color: "purple" },
          { label: "Stamp Duty + Reg (Ceiling)", value: result.AR, color: "green"  },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl border p-4 bg-${color}-50 border-${color}-100`}>
            <p className={`text-xs font-semibold text-${color}-600 uppercase tracking-wide mb-1`}>{label}</p>
            <p className={`text-xl font-bold text-${color}-800`}>{value > 0 ? inr(value) : "–"}</p>
          </div>
        ))}
      </div>

      {/* Group 1: Area & Rate */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Area & Rate</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {[
              { code:"H",  label:"Unit Area (Sq. Ft.)",    value: result.H_sqft, formula:`ROUND(${fmt2(result.H_sqm)} sqm × 10.764, 2)` },
              { code:"Y",  label:"Loaded Rate PSF",         value: result.Y,      formula:`X × (1 + ${loadPct})` },
              { code:"Z",  label:"Actual Agreement Value",  value: result.Z,      formula:`H × Y` },
            ].map(r => <ResultRow key={r.code} {...r} />)}
          </tbody>
        </table>
      </div>

      {/* Group 2: Agreement & TDS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Agreement Value & TDS</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {[
              { code:"AA", label:"Agreement Value",          value: result.AA, formula:`Z ÷ (1 + ${divPct})`,       highlight:true },
              { code:"AB", label:"TDS @ 1%",                 value: result.AB, formula:`ROUND(AA × 1%, 0)` },
              { code:"AC", label:"TDS Due @ 20%",            value: result.AC, formula:`ROUND(AB × 20%, 0)` },
              { code:"AD", label:"Due @ 9.9%",               value: result.AD, formula:`AA × 9.9%` },
              { code:"AE", label:"Due @ 10.10%",             value: result.AE, formula:`AA × 10.10%` },
            ].map(r => <ResultRow key={r.code} {...r} />)}
          </tbody>
        </table>
      </div>

      {/* Group 3: Payment Tracking */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Payment Tracking</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {[
              { code:"AF", label:"Amount Recd. Till Date",   value: result.AF, formula:`User input`,              showZero:true },
              { code:"AG", label:"Balance (As per Due)",      value: result.AG, formula:`ROUND(AD + AE − AF, 0)`, highlight:true },
              { code:"AH", label:"Due Amount Excl. T.D.S",   value: result.AH, formula:`AG − AC` },
              { code:"AI", label:"Balance (100%)",            value: result.AI, formula:`AA − AF`,                highlight:true },
            ].map(r => <ResultRow key={r.code} {...r} />)}
          </tbody>
        </table>
      </div>

      {/* Group 4: GST */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
        <div className="px-4 py-3 bg-purple-50 border-b border-purple-100">
          <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">GST ({gstPct})</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {[
              { code:"AJ", label:"Total GST",                value: result.AJ, formula:`AA × ${gstPct}`,  highlight:true },
              { code:"AK", label:"GST Due Milestone @ 20%",  value: result.AK, formula:`AJ × 20%` },
              { code:"AL", label:"GST Recd. Till Date",      value: result.AL, formula:`User input`,       showZero:true },
              { code:"AM", label:"Balance (As per Due)",      value: result.AM, formula:`AK − AL`,         highlight:true },
              { code:"AN", label:"Balance (As per 100%)",    value: result.AN, formula:`AJ − AL`,          highlight:true },
            ].map(r => <ResultRow key={r.code} {...r} />)}
          </tbody>
        </table>
      </div>

      {/* Group 5: Stamp Duty & Registration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="px-4 py-3 bg-green-50 border-b border-green-100">
          <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Stamp Duty & Registration</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {[
              { code:"AO", label:"Stamp Duty @ 6%",              value: result.AO, formula:`ROUND(AA × 6%, 0)` },
              { code:"AP", label:"Registration Charges",         value: result.AP, formula:`Fixed input` },
              { code:"AQ", label:"Total (Stamp + Reg)",          value: result.AQ, formula:`AO + AP` },
              { code:"AR", label:"Total Stamp + Reg (Ceiling)",  value: result.AR, formula:`CEILING(AQ, 100)`, highlight:true },
            ].map(r => <ResultRow key={r.code} {...r} />)}
          </tbody>
        </table>
      </div>

      {/* ── APPEND TO GOOGLE SHEET ───────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Save to Google Sheet</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Appends one row with all input + calculated values to your connected sheet.
            </p>
          </div>
          <button
            onClick={appendToSheet}
            disabled={appendStatus === "loading" || result.AA === 0}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {appendStatus === "loading" ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Saving…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 4v16m8-8H4" />
                </svg>
                Append Row
              </>
            )}
          </button>
        </div>

        {appendMsg && (
          <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium ${
            appendStatus === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-600"
          }`}>
            {appendMsg}
          </div>
        )}

        {result.AA === 0 && (
          <p className="mt-2 text-xs text-gray-400">Fill in Unit Area and Rate PSF to enable.</p>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center mt-4">
        All calculations are client-side. Switching unit type fully recomputes every field from its own config.
      </p>
    </main>
  );
}
