"use client";

import { apiFetch } from "@/lib/credsClient";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import type { LintFinding, LintCategory } from "@/lib/types";
import { IconLint, IconAlert } from "@/components/icons";

const CATEGORY_META: Record<LintCategory, { label: string; color: string; star?: boolean }> = {
  "contradiction": { label: "Contradiction", color: "#ef4444" },
  "superseded-referenced": { label: "Superseded but referenced", color: "#f59e0b" },
  "ownership-orphan": { label: "Ownership orphan", color: "#8b5cf6" },
  "interpretation-drift": { label: "Interpretation drift", color: "#ec4899", star: true },
  "silent-commitment": { label: "Silent commitment", color: "#0ea5e9", star: true },
  "stakeholder-blackout": { label: "Stakeholder blackout", color: "#1E40AF", star: true },
};

const SEV: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function LintPage() {
  const [findings, setFindings] = useState<LintFinding[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LintCategory | "all">("all");

  async function run() {
    setLoading(true);
    const r = await apiFetch("/api/lint").then((r) => r.json());
    setFindings(r.findings);
    setSummary(r.summary);
    setLoading(false);
  }
  useEffect(() => { run(); }, []);

  const shown = filter === "all" ? findings : findings.filter((f) => f.category === filter);

  return (
    <>
      <PageHeader
        title="Lint — Company-Wide Alignment CI"
        subtitle="ESLint for the org. Every finding is a graph query, explainable by traversal."
        right={<button onClick={run} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-600 cursor-pointer"><IconLint width={16} height={16} /> Re-run lint</button>}
      />
      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* category chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Chip active={filter === "all"} onClick={() => setFilter("all")} label={`All (${findings.length})`} />
          {(Object.keys(CATEGORY_META) as LintCategory[]).map((c) => (
            <Chip
              key={c}
              active={filter === c}
              onClick={() => setFilter(c)}
              label={`${CATEGORY_META[c].label} (${summary[c] || 0})`}
              color={CATEGORY_META[c].color}
              star={CATEGORY_META[c].star}
            />
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-slate-200/50 animate-pulse" />)}</div>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-700">No findings in this category. The org is aligned here.</div>
        ) : (
          <div className="space-y-3">
            {shown.map((f) => {
              const meta = CATEGORY_META[f.category];
              return (
                <div key={f.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: meta.color }} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-ink-900">{f.title}</h3>
                        {meta.star && <span className="rounded bg-slate-900 text-white text-[9px] px-1.5 py-0.5 font-bold tracking-wide">ORG-NATIVE</span>}
                        <span className={`ml-auto rounded border px-2 py-0.5 text-[10px] font-medium uppercase ${SEV[f.severity]}`}>{f.severity}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{f.detail}</p>
                      <div className="mt-2 text-[11px] text-slate-400 font-mono">
                        traversal: {meta.label.toLowerCase().replace(/\s+/g, "_")} · {f.beliefIds.length} belief node(s) · {f.stakeholderIds.length} stakeholder(s)
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Chip({ active, onClick, label, color, star }: { active: boolean; onClick: () => void; label: string; color?: string; star?: boolean }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors cursor-pointer ${active ? "bg-ink-900 text-white border-ink-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
      {label}
      {star && <span className="text-meridian">★</span>}
    </button>
  );
}
