import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Build the row matching the exact header order
    const row = [
      body.srNo          ?? "",   // Sr.No.
      body.unitType      ?? "",   // Unit Type
      body.unitNo        ?? "",   // Unit No.
      body.floor         ?? "",   // Floor
      body.unitSqm       ?? "",   // Unit Area Sq. Mt.
      body.balconySqm    ?? "",   // Balcony Sq. Mt.
      body.totalSqm      ?? "",   // Total Unit Area Sq. Mt.
      body.totalSqft     ?? "",   // Total Unit Area Sq. Ft.
      body.soldUnsold    ?? "",   // Sold / Unsold
      body.dateOfBooking ?? "",   // Date of Booking
      body.applicant1  ?? "",   // Applicants Name
      body.applicant2  ?? "",   // Co-Applicant's Name
      body.applicant3  ?? "",   // 3rd Applicant's Name
      "",                       // Company's Name (If Any) — not collected yet
      "",                       // Company's Pan Number — not collected yet
      "",                       // Company's GST Registration Number — not collected yet
      body.address     ?? "",   // Address
      body.contactNo   ?? "",   // Contact No.
      body.altContactNo ?? "",  // Alternate Contact No.
      body.emailId     ?? "",   // Email Id
      body.pan         ?? "",   // Applicant's Pan No.
      body.aadhar      ?? "",   // Applicant's Aadhar No.
      body.X           ?? "",   // RATE (PSF)
      body.Y           ?? "",   // Actual PSF
      body.Z           ?? "",   // Actual Agreement value
      body.AA          ?? "",   // Agreement Value
      body.AB          ?? "",   // TDS 1% OF Agreement Value
      body.AC          ?? "",   // TDS As per Due 20%
      body.AD          ?? "",   // Due 9.9%
      body.AE          ?? "",   // Due 10.10%
      body.AF          ?? "",   // Amount Recd. till Date
      body.AG          ?? "",   // Balance (As per Due)
      body.AH          ?? "",   // Due Amount Excluding T.D.S
      body.AI          ?? "",   // Balance (100%)
      body.AJ          ?? "",   // Total G.S.T @12%
      body.AK          ?? "",   // Due As Milestone (%)
      body.AL          ?? "",   // G.S.T. Recd. (Till Date)
      body.AM          ?? "",   // Balance (As per Due) — GST
      body.AN          ?? "",   // Balance (As per 100%) — GST
      body.AO          ?? "",   // Stamp duty @ 6%
      body.AP          ?? "",   // Registration Charges
      body.AQ          ?? "",   // TOTAL
      body.AR          ?? "",   // Total (Stampduty + Reg.)
      "",                       // Amount Recd. — not collected yet
      "",                       // Total Amount Received Till Date — not collected yet
      "",                       // Recd. On — not collected yet
      "",                       // SDR Paid on — not collected yet
      "",                       // Legal Charges (15k) — not collected yet
      body.parkingLength ?? "",  // Length (M)
      body.parkingWidth  ?? "",  // Width (M)
      body.parkingHeight ?? "",  // Height (M)
      body.parkingTotal  ?? "",  // TOTAL (M)
      "",                        // Parking Conf. — not collected yet
      body.parkingNo    ?? "",   // Parking No.
      body.parkingLevel ?? "",   // Basement Level
      "",                        // (spacer column per header)
      body.shareCertNo  ?? "",   // SHARE CERTIFICATE NO.
      body.shareCertFrom ?? "",  // SHARE ALLOTED FROM
      body.shareCertTo   ?? "",  // SHARE ALLOTED (TO)
      body.numShares     ?? "",  // TOTAL NO. OF SHARES
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Sheets append error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to append row" },
      { status: 500 }
    );
  }
}
