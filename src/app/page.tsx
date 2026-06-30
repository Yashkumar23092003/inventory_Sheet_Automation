"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Render fully client-side. Both are interactive tools with no SSR benefit, and
// skipping SSR avoids hydration mismatches from form-filler browser extensions.
const CostSheetCalculator = dynamic(() => import("./CostSheetCalculator"), {
  ssr: false,
  loading: () => <Loading title="Cost Sheet Calculator" />,
});
const SheetRecords = dynamic(() => import("./components/SheetRecords"), {
  ssr: false,
  loading: () => <Loading title="Sheet Records" />,
});

function Loading({ title }: { title: string }) {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>
      <div className="animate-pulse text-sm text-gray-400">Loading…</div>
    </main>
  );
}

type Tab = "calculator" | "records";

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("calculator");

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          <TabButton active={tab === "calculator"} onClick={() => setTab("calculator")}>
            Cost Sheet Calculator
          </TabButton>
          <TabButton active={tab === "records"} onClick={() => setTab("records")}>
            Sheet Records
          </TabButton>
        </div>
      </div>

      {/* Calculator stays mounted (hidden) so its inputs are preserved across tabs.
          Records mounts on open so it always fetches the latest sheet data. */}
      <div className={tab === "calculator" ? "" : "hidden"}>
        <CostSheetCalculator />
      </div>
      {tab === "records" && <SheetRecords />}
    </div>
  );
}
