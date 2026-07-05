"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import type { AlignmentReport } from "@/lib/types";
import { IconRitual, IconArrow, IconCheck } from "@/components/icons";
import { relDate } from "@/lib/utils";

export default function RitualsPage() {
  const [reports, setReports] = useState<AlignmentReport[]>([]);
  const [done, setDone] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/align").then((r) => r.json()).then((d) => setReports(d.reports.filter((r: AlignmentReport) => r.ritual)));
  }, []);

  async function schedule(subjectId: string, title: string) {
    const r = await fetch("/api/ritual", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId, action: "schedule" }),
    }).then((r) => r.json());
    if (r.ics) {
      const blob = new Blob([r.ics], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${title.replace(/\s+/g, "-")}.ics`; a.click();
    }
    setDone((d) => ({ ...d, [subjectId]: "scheduled" }));
  }

  async function resolve(subjectId: string) {
    await fetch("/api/ritual", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId, action: "resolve", resolvedBelief: "Canonical belief captured." }),
    });
    setDone((d) => ({ ...d, [subjectId]: "resolved" }));
  }

  return (
    <>
      <PageHeader title="Ritual Composer" subtitle="align() proposes · humans decide · outcomes become training data" />
      <div className="max-w-4xl mx-auto px-8 py-8 space-y-5">
        {reports.length === 0 && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-700">No open rituals — every tracked subject is aligned.</div>}
        {reports.map((r) => {
          const ritual = r.ritual!;
          const st = done[r.subject.id];
          return (
            <div key={r.subject.id} className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-primary/[0.04] to-transparent">
                <div className="flex items-center gap-2 text-primary text-sm font-semibold"><IconRitual width={18} height={18} /> {ritual.title}</div>
                <p className="mt-1 text-xs text-slate-500">Subject: {r.subject.title} · alignment {Math.round(r.score * 100)}%</p>
              </div>
              <div className="p-5 grid md:grid-cols-2 gap-5">
                <div>
                  <h4 className="text-xs uppercase tracking-widest text-slate-400 mb-2">Pre-filled agenda</h4>
                  <ul className="space-y-1.5">
                    {ritual.agenda.map((a, i) => <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-primary">{i + 1}.</span>{a}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-widest text-slate-400 mb-2">Evidence chains attached</h4>
                  <div className="space-y-2">
                    {ritual.evidenceChains.map((chain, i) => (
                      <div key={i} className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                        {chain.map((e, j) => <div key={j} className="truncate" title={e.excerpt}>• {e.label} <span className="text-slate-400">({relDate(e.at)})</span></div>)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-5 pb-5 flex items-center gap-2">
                {!st && <button onClick={() => schedule(r.subject.id, ritual.title)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 cursor-pointer">Export invite (.ics) <IconArrow width={14} height={14} /></button>}
                {st === "scheduled" && <button onClick={() => resolve(r.subject.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 text-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-50 cursor-pointer">Capture resolution <IconCheck width={14} height={14} /></button>}
                {st === "resolved" && <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-medium"><IconCheck width={16} height={16} /> Resolved — fed to improve()</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
