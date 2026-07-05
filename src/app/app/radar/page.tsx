"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { AlignmentCard } from "@/components/AlignmentCard";
import type { AlignmentReport } from "@/lib/types";
import { pct, scoreColor, scoreLabel } from "@/lib/utils";

export default function RadarPage() {
  const [reports, setReports] = useState<AlignmentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/align").then((r) => r.json());
    setReports(r.reports);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const avg = reports.length ? reports.reduce((s, r) => s + r.score, 0) / reports.length : 0;
  const conflicts = reports.filter((r) => r.score < 0.7).length;

  return (
    <>
      <PageHeader
        title="Alignment Radar"
        subtitle="Subjects ordered by declining alignment — red pulses when a contradiction lands"
        right={
          <Link href="/app/lint" className="text-sm text-primary font-medium hover:underline cursor-pointer">Run full lint →</Link>
        }
      />
      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Stat label="Org alignment" value={pct(avg)} accent={scoreColor(avg)} sub={scoreLabel(avg)} />
          <Stat label="Subjects tracked" value={String(reports.length)} />
          <Stat label="In conflict" value={String(conflicts)} accent={conflicts ? "#ef4444" : "#10b981"} />
          <Stat label="Open rituals" value={String(reports.filter((r) => r.ritual).length)} accent="#1E40AF" />
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-5">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 rounded-2xl bg-slate-200/50 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {reports.map((r) => (
              <AlignmentCard key={r.subject.id} report={r} expanded={open === r.subject.id} onToggle={() => setOpen(open === r.subject.id ? null : r.subject.id)} onChanged={load} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="text-xs uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-extrabold" style={{ color: accent || "#0f1830" }}>{value}</div>
      {sub && <div className="text-xs font-medium" style={{ color: accent }}>{sub}</div>}
    </div>
  );
}
