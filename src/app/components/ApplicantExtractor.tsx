"use client";

import { useState, useRef, useEffect } from "react";
import type { ApplicantData } from "../api/extract/route";

interface Props {
  applicants: ApplicantData[];
  onChange: (applicants: ApplicantData[]) => void;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";
const MAX_MB = 15;

const EMPTY: ApplicantData = {
  name: "", pan: "", aadhar: "", dob: "", gender: "",
  fatherName: "", address: "", docType: "unknown",
};

// One block = one applicant: its own Aadhaar + PAN uploads and extracted data.
interface Slot {
  id: number;
  aadhar: File[];
  pan: File[];
  data: ApplicantData;
  loading: boolean;
  error: string | null;
}

let nextId = 1;
const newSlot = (): Slot => ({
  id: nextId++,
  aadhar: [],
  pan: [],
  data: { ...EMPTY },
  loading: false,
  error: null,
});

// ── Upload zone (used twice per applicant block) ──────────────────────────────
function UploadZone({
  index, label, files, onFiles,
}: {
  index: number;
  label: string;
  files: File[];
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const merge = (incoming: File[]) => {
    const map = new Map(files.map((f) => [f.name + f.size, f]));
    for (const f of incoming) map.set(f.name + f.size, f);
    onFiles(Array.from(map.values()));
  };

  return (
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-700 mb-2">
        <span className="font-medium">{index}.</span> {label}
      </p>
      <div
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files) merge(Array.from(e.dataTransfer.files));
        }}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 p-4 min-h-[110px] flex flex-col justify-between hover:border-blue-400 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => e.target.files && merge(Array.from(e.target.files))}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md bg-white text-sm text-gray-700 hover:bg-gray-50 shadow-sm w-fit"
        >
          <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload
        </button>

        {files.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-600">
                <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {f.name.length > 18 ? f.name.slice(0, 16) + "…" : f.name}
                <button
                  onClick={() => onFiles(files.filter((_, idx) => idx !== i))}
                  className="ml-0.5 text-gray-400 hover:text-red-500 font-bold"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 mt-2">JPG, PNG, WEBP or PDF · multiple allowed</p>
        )}
      </div>
    </div>
  );
}

export default function ApplicantExtractor({ onChange }: Props) {
  const [slots, setSlots] = useState<Slot[]>([newSlot()]);

  // Sync the extracted data up to the parent whenever slots change.
  // Done in an effect (not during render) to avoid "setState while rendering".
  useEffect(() => {
    onChange(slots.map((s) => s.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  const patchSlot = (id: number, patch: Partial<Slot>) =>
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const patchData = (id: number, field: keyof ApplicantData, value: string) =>
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, data: { ...s.data, [field]: value } } : s)));

  const addApplicant = () => setSlots((prev) => [...prev, newSlot()]);

  const removeApplicant = (id: number) =>
    setSlots((prev) => {
      const next = prev.filter((s) => s.id !== id);
      return next.length ? next : [newSlot()];
    });

  const clearAll = () => setSlots([newSlot()]);

  const extractSlot = async (id: number) => {
    const slot = slots.find((s) => s.id === id);
    if (!slot) return;
    const all = [...slot.aadhar, ...slot.pan];
    if (all.length === 0) return;

    const bad = all.filter((f) => !f.type.startsWith("image/") && f.type !== "application/pdf");
    if (bad.length) {
      patchSlot(id, { error: `Unsupported: ${bad.map((f) => f.name).join(", ")}. Use JPG, PNG, WEBP or PDF.` });
      return;
    }
    const tooBig = all.filter((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig.length) {
      patchSlot(id, { error: `File too large (max ${MAX_MB} MB): ${tooBig.map((f) => f.name).join(", ")}` });
      return;
    }

    // mark loading (use a direct state update so we don't clobber files)
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, loading: true, error: null } : s)));

    try {
      const form = new FormData();
      for (const f of all) form.append("files", f);

      const res = await fetch("/api/extract", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`);

      const docs = (body.applicants ?? []) as ApplicantData[];
      if (!docs.length) throw new Error("No details could be read. Please upload clearer documents.");

      // These all belong to ONE person → force-combine into a single applicant,
      // keeping any value the user has already typed. The useEffect syncs to parent.
      setSlots((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, loading: false, error: null, data: combineToOne([s.data, ...docs]) }
            : s
        )
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Extraction failed.";
      setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, loading: false, error: msg } : s)));
    }
  };

  const filledApplicants = slots.map((s) => s.data).filter((d) => d.name || d.pan || d.aadhar);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Applicant KYC — Aadhaar &amp; PAN
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            One block per applicant. Upload their Aadhaar &amp; PAN, then extract. AI reads the details.
          </p>
        </div>
        <button onClick={clearAll} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 shrink-0 ml-4">
          Clear All
        </button>
      </div>

      {/* One block per applicant */}
      <div className="space-y-5">
        {slots.map((slot, idx) => {
          const hasFiles = slot.aadhar.length > 0 || slot.pan.length > 0;
          const hasData = !!(slot.data.name || slot.data.pan || slot.data.aadhar);
          return (
            <div key={slot.id} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Applicant {idx + 1}
                </span>
                {slots.length > 1 && (
                  <button onClick={() => removeApplicant(slot.id)} className="text-xs text-red-400 hover:text-red-600">
                    Remove
                  </button>
                )}
              </div>

              {/* Two upload zones */}
              <div className="flex flex-col sm:flex-row gap-4">
                <UploadZone index={1} label="Aadhaar Card(s)" files={slot.aadhar} onFiles={(f) => patchSlot(slot.id, { aadhar: f })} />
                <UploadZone index={2} label="PAN Card(s)" files={slot.pan} onFiles={(f) => patchSlot(slot.id, { pan: f })} />
              </div>

              {/* Extract button */}
              {hasFiles && (
                <button
                  onClick={() => extractSlot(slot.id)}
                  disabled={slot.loading}
                  className="mt-3 w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {slot.loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Reading documents…
                    </>
                  ) : (
                    "Extract Applicant Details"
                  )}
                </button>
              )}

              {slot.error && (
                <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {slot.error}
                </div>
              )}

              {/* Extracted / editable fields */}
              {hasData && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                  <Field label="Full Name" value={slot.data.name} onChange={(v) => patchData(slot.id, "name", v)} className="sm:col-span-2" placeholder="As on document" />
                  <Field label="PAN Number" value={slot.data.pan} onChange={(v) => patchData(slot.id, "pan", v.toUpperCase())} mono placeholder="ABCDE1234F" />
                  <Field label="Aadhaar Number" value={slot.data.aadhar} onChange={(v) => patchData(slot.id, "aadhar", v)} mono placeholder="XXXX XXXX XXXX" />
                  <Field label="Date of Birth" value={slot.data.dob} onChange={(v) => patchData(slot.id, "dob", v)} placeholder="DD/MM/YYYY" />
                  <Field label="Gender" value={slot.data.gender} onChange={(v) => patchData(slot.id, "gender", v)} placeholder="Male / Female" />
                  <Field label="Father's Name" value={slot.data.fatherName} onChange={(v) => patchData(slot.id, "fatherName", v)} className="sm:col-span-2" placeholder="If on PAN" />
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                    <textarea
                      value={slot.data.address}
                      onChange={(e) => patchData(slot.id, "address", e.target.value)}
                      placeholder="Address as on Aadhaar"
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add another applicant */}
      <button
        onClick={addApplicant}
        className="mt-4 w-full py-2 rounded-lg border border-dashed border-blue-300 text-blue-600 text-sm font-medium hover:bg-blue-50 flex items-center justify-center gap-1.5"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Applicant
      </button>

      {/* Combined values for multiple applicants */}
      {filledApplicants.length > 1 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">
            Combined (all applicants, joined with “ / ”)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-gray-700">
            {(["name", "pan", "aadhar", "address"] as const).map((field) => (
              <div key={field}>
                <span className="font-medium capitalize text-gray-500">{field}: </span>
                {filledApplicants.map((a) => a[field]).filter(Boolean).join(" / ") || "–"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small input field helper ──────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, mono = false, className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${mono ? "font-mono tracking-wide" : ""}`}
      />
    </div>
  );
}

// Combine several extracted docs (Aadhaar + PAN of the SAME person) into one,
// taking the first non-empty value for each field. Earlier items win, so the
// user's already-typed values (passed first) are preserved.
function combineToOne(docs: ApplicantData[]): ApplicantData {
  const pick = (k: keyof ApplicantData) =>
    (docs.map((d) => d[k]).find((v) => v && String(v).trim()) as string) ?? "";
  return {
    name: pick("name"),
    pan: pick("pan"),
    aadhar: pick("aadhar"),
    dob: pick("dob"),
    gender: pick("gender"),
    fatherName: pick("fatherName"),
    address: pick("address"),
    docType: "unknown",
  };
}
