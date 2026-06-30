import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

// Always fetch fresh — never cache, so the tab shows live sheet data.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return {
    sheets: google.sheets({ version: "v4", auth }),
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
  };
}

// Convert a 0-based column index to an A1 column letter (0→A, 26→AA, 60→BI).
function colLetter(index: number): string {
  let s = "";
  let n = index;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

// ── Read all rows ─────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const { sheets, spreadsheetId } = getSheetsClient();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1!A1:BI",
      valueRenderOption: "FORMATTED_VALUE",
    });

    const values = resp.data.values ?? [];
    const headers = (values[0] ?? []) as string[];
    const rows = values.slice(1) as string[][];

    return NextResponse.json(
      { headers, rows },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    console.error("sheet-data GET error:", err);
    const msg = err instanceof Error ? err.message : "Failed to read sheet.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── Update one row in place ───────────────────────────────────────────────────
// Body: { rowIndex: number (0-based data row), values: string[] (full row) }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { rowIndex, values } = body as { rowIndex: number; values: unknown[] };

    if (typeof rowIndex !== "number" || rowIndex < 0 || !Array.isArray(values)) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    if (values.length === 0 || values.length > 61) {
      return NextResponse.json({ error: "Row must have 1–61 values." }, { status: 400 });
    }

    const { sheets, spreadsheetId } = getSheetsClient();
    // Data row 0 lives on sheet row 2 (row 1 is the header).
    const sheetRow = rowIndex + 2;
    const endCol = colLetter(values.length - 1);
    const range = `Sheet1!A${sheetRow}:${endCol}${sheetRow}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values as string[]] },
    });

    return NextResponse.json({ success: true, updatedRange: range });
  } catch (err) {
    console.error("sheet-data PUT error:", err);
    const msg = err instanceof Error ? err.message : "Failed to update row.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
