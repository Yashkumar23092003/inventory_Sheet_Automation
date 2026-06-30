import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ApplicantData {
  name: string;
  pan: string;
  aadhar: string;
  dob: string;        // date of birth (DD/MM/YYYY if available)
  gender: string;     // Male / Female / Other
  fatherName: string; // father's / guardian's name (often on PAN)
  address: string;    // full address (from Aadhaar)
  docType: "pan" | "aadhar" | "unknown";
}

const EMPTY: ApplicantData = {
  name: "", pan: "", aadhar: "", dob: "", gender: "",
  fatherName: "", address: "", docType: "unknown",
};

const SYSTEM_PROMPT = `You are an expert OCR and data-extraction assistant for Indian identity documents (Aadhaar cards and PAN cards). The document may be a clear photo, a scan, or a scanned PDF. Read every field carefully.

Extract these fields and return ONLY valid JSON (no markdown, no commentary):
{
  "name": "Full name of the card holder exactly as printed",
  "pan": "10-character PAN (5 letters, 4 digits, 1 letter, e.g. ABCDE1234F). Empty if not present.",
  "aadhar": "12-digit Aadhaar number, digits only no spaces. Empty if not present.",
  "dob": "Date of birth as printed (DD/MM/YYYY). Empty if not present.",
  "gender": "Male, Female, or Other. Empty if not present.",
  "fatherName": "Father's or guardian's name if printed (common on PAN cards). Empty otherwise.",
  "address": "Full postal address combined into one line (present on Aadhaar). Empty otherwise.",
  "docType": "pan if this is a PAN card, aadhar if this is an Aadhaar card, otherwise unknown"
}

Rules:
- If a field is not visible on the document, return an empty string for it — never guess.
- A PAN card has a PAN number and usually the holder's name, father's name, and DOB. It has NO Aadhaar number and NO address.
- An Aadhaar card has a 12-digit Aadhaar number, name, DOB, gender, and address. It has NO PAN.`;

/** Parse the model's JSON reply, tolerating markdown fences. */
function parseReply(raw: string): ApplicantData {
  try {
    const cleaned = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return { ...EMPTY, ...parsed };
  } catch {
    return { ...EMPTY };
  }
}

/** Build the user content part for one file — image_url for images, file for PDFs. */
function buildContentPart(base64: string, mimeType: string, filename: string) {
  if (mimeType === "application/pdf") {
    return {
      type: "file" as const,
      file: { filename, file_data: `data:application/pdf;base64,${base64}` },
    };
  }
  // HEIC/HEIF from iPhones → relabel as jpeg so the API accepts it
  const safeMime = mimeType === "image/heic" || mimeType === "image/heif" ? "image/jpeg" : mimeType;
  return {
    type: "image_url" as const,
    image_url: { url: `data:${safeMime};base64,${base64}`, detail: "high" as const },
  };
}

async function extractOne(base64: string, mimeType: string, filename: string): Promise<ApplicantData> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 600,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: [
          buildContentPart(base64, mimeType, filename),
          { type: "text", text: "Extract all fields from this identity document." },
        ] as any,
      },
    ],
  });
  return parseReply(response.choices[0]?.message?.content?.trim() ?? "{}");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
    }

    const results = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString("base64");
        const mimeType = file.type || "application/octet-stream";
        return extractOne(base64, mimeType, file.name || "document");
      })
    );

    const merged = mergeApplicants(results);

    if (!merged.length) {
      return NextResponse.json(
        { error: "Could not read any details from the uploaded documents. Please upload clearer files." },
        { status: 422 }
      );
    }

    return NextResponse.json({ applicants: merged });
  } catch (err) {
    console.error("Extract error:", err);
    const msg = err instanceof Error ? err.message : "Extraction failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── Merge: combine PAN + Aadhaar of the same person into one applicant ────────

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function isSamePerson(a: ApplicantData, b: ApplicantData): boolean {
  if (a.pan && b.pan && a.pan === b.pan) return true;
  if (a.aadhar && b.aadhar && a.aadhar === b.aadhar) return true;
  if (a.name && b.name && normalize(a.name) === normalize(b.name)) return true;
  return false;
}

function firstNonEmpty(group: ApplicantData[], key: keyof ApplicantData): string {
  return (group.map((d) => d[key]).find((v) => v && String(v).trim()) as string) ?? "";
}

function mergeApplicants(docs: ApplicantData[]): ApplicantData[] {
  // Drop completely empty extractions
  const valid = docs.filter((d) => d.name || d.pan || d.aadhar);
  const groups: ApplicantData[][] = [];

  for (const doc of valid) {
    const existing = groups.find((g) => g.some((d) => isSamePerson(d, doc)));
    if (existing) existing.push(doc);
    else groups.push([doc]);
  }

  return groups.map((group) => ({
    name:       firstNonEmpty(group, "name"),
    pan:        firstNonEmpty(group, "pan"),
    aadhar:     firstNonEmpty(group, "aadhar"),
    dob:        firstNonEmpty(group, "dob"),
    gender:     firstNonEmpty(group, "gender"),
    fatherName: firstNonEmpty(group, "fatherName"),
    address:    firstNonEmpty(group, "address"),
    docType:    "unknown" as const,
  }));
}
