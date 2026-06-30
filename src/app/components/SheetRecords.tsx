"use client";

import { useEffect, useMemo, useState } from "react";

// Column indices (0-based) for the 60-column sheet layout.
const COL = {
  unitType: 1,
  unitNo: 2,
  soldUnsold: 8,
  totalSqft: 7,
  applicant: 10,
  pan: 20,
  aadhar: 21,
  agreementValue: 25, // AA
};

// Section boundaries [startCol, endColInclusive, title]
const SECTIONS: [number, number, string][] = [
  [0, 9, "Unit Information"],
  [10, 21, "Applicant & Contact"],
  [22, 33, "Agreement Value, TDS & Payments"],
  [34, 38, "GST"],
  [39, 42, "Stamp Duty & Registration"],
  [43, 47, "Other Payments"],
  [48, 54, "Parking"],
  [55, 59, "Share Certificate"],
];

interface SheetResponse {
  headers: string[];
  rows: string[][];
}

export default function SheetRecords() {
  const [data, setData] = useState<SheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sheet-data", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`);
      setData(body as SheetResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sheet data.");
    } finally {
      setLoading(false);
    }
  };

  const openUnit = (i: number) => {
    setSelected(i);
    setEditing(false);
    setSaveMsg(null);
  };

  const startEdit = () => {
    if (selected === null || !data) return;
    const row = data.rows[selected];
    setDraft(Array.from({ length: data.headers.length }, (_, c) => (row[c] ?? "").toString()));
    setSaveMsg(null);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (selected === null) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/sheet-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: selected, values: draft }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`);
      setData((prev) =>
        prev ? { ...prev, rows: prev.rows.map((r, i) => (i === selected ? draft.slice() : r)) } : prev
      );
      setEditing(false);
      setSaveMsg({ ok: true, text: "Saved to sheet." });
    } catch (e) {
      setSaveMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const headers = data?.headers ?? [];
  const rows = data?.rows ?? [];

  // Filter by Unit No. (partial, case-insensitive) — checks both Unit No. columns.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const indexed = rows.map((row, i) => ({ row, i }));
    if (!q) return indexed;
    return indexed.filter(({ row }) => (row[COL.unitNo] ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  const cell = (row: string[], i: number) => (row[i] ?? "").toString();
  const unitLabel = (row: string[]) =>
    cell(row, COL.unitNo) || "(no unit no.)";

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sheet Records</h1>
          <p className="text-sm text-gray-500 mt-1">
            Live data from the connected Google Sheet · {rows.length} record{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <svg className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
          placeholder="Search by Unit No. (e.g. G-12, 101)…"
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading && !data && (
        <div className="text-center py-12 text-sm text-gray-400">Loading sheet data…</div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && data && rows.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">No records in the sheet yet.</div>
      )}

      {/* Detail view for the selected unit */}
      {selected !== null && rows[selected] && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 gap-3">
            <button
              onClick={() => { setSelected(null); setEditing(false); setSaveMsg(null); }}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to list
            </button>

            {/* Edit / Save / Cancel */}
            {!editing ? (
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditing(false); setSaveMsg(null); }}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Saving…
                    </>
                  ) : "Save to Sheet"}
                </button>
              </div>
            )}
          </div>

          {saveMsg && (
            <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-medium ${
              saveMsg.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-600"
            }`}>
              {saveMsg.text}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <p className="text-xs uppercase tracking-wide opacity-80">Unit No.</p>
              <h2 className="text-xl font-bold">{unitLabel(rows[selected])}</h2>
              <p className="text-sm opacity-90 mt-0.5">
                {cell(rows[selected], COL.unitType) || "—"}
                {cell(rows[selected], COL.applicant) ? ` · ${cell(rows[selected], COL.applicant)}` : ""}
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {SECTIONS.map(([start, end, title]) => {
                const fields: { label: string; col: number }[] = [];
                for (let c = start; c <= end && c < headers.length; c++) {
                  const label = headers[c] || `Column ${c + 1}`;
                  if (!label.trim()) continue;
                  fields.push({ label, col: c });
                }
                if (!fields.length) return null;
                return (
                  <div key={title} className="px-5 py-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{title}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                      {fields.map(({ label, col }) => {
                        const value = editing ? (draft[col] ?? "") : cell(rows[selected], col);
                        return (
                          <div key={col} className={`text-sm ${editing ? "" : "flex justify-between gap-3 border-b border-dashed border-gray-100 pb-1.5"}`}>
                            <span className={`text-gray-500 ${editing ? "block mb-1 text-xs font-medium" : ""}`}>{label}</span>
                            {editing ? (
                              <input
                                type="text"
                                value={value}
                                onChange={(e) =>
                                  setDraft((d) => {
                                    const next = d.slice();
                                    next[col] = e.target.value;
                                    return next;
                                  })
                                }
                                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              <span className={`font-medium text-right ${value ? "text-gray-900" : "text-gray-300"}`}>
                                {value || "—"}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* List of units (hidden when a unit is open) */}
      {selected === null && data && rows.length > 0 && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">
              No unit matches “{search}”.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(({ row, i }) => (
                <button
                  key={i}
                  onClick={() => openUnit(i)}
                  className="w-full text-left bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition px-4 py-3 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{unitLabel(row)}</span>
                      {cell(row, COL.soldUnsold) && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          cell(row, COL.soldUnsold).toLowerCase() === "sold"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {cell(row, COL.soldUnsold)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {cell(row, COL.unitType) || "—"}
                      {cell(row, COL.applicant) ? ` · ${cell(row, COL.applicant)}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">Agreement Value</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {cell(row, COL.agreementValue) || "—"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
