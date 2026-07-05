"use client";

import { apiFetch } from "@/lib/credsClient";
import { useState } from "react";
import type { AlignmentReport, EnrichedBelief } from "@/lib/types";
import { pct, scoreColor, scoreLabel, relDate } from "@/lib/utils";
import { IconAlert, IconCheck, IconThumbUp, IconThumbDown, IconRitual, IconUp, IconDown, IconArrow } from "./icons";

const STANCE = {
  1: { label: "affirms", cls: "text-emerald-600 bg-emerald-50" },
  0: { label: "neutral", cls: "text-slate-500 bg-slate-100" },
  "-1": { label: "contradicts", cls: "text-red-600 bg-red-50" },
} as const;

export function AlignmentCard({ report, expanded, onToggle, onChanged }: {
  report: AlignmentReport; expanded: boolean; onToggle: () => void; onChanged: () => void;
}) {
  const [voted, setVoted] = useState<1 | -1 | null>(null);
  const [ritualState, setRitualState] = useState<string | null>(null);
  const color = scoreColor(report.score);
  const critical = report.score < 0.7;

  async function vote(v: 1 | -1) {
    setVoted(v);
    await apiFetch("/api/feedback", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "alignment", targetId: report.subject.id, vote: v }),
    });
  }

  async function scheduleRitual() {
    const r = await apiFetch("/api/ritual", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId: report.subject.id, action: "schedule" }),
    }).then((r) => r.json());
    if (r.ics) {
      const blob = new Blob([r.ics], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${report.subject.title.replace(/\s+/g, "-")}.ics`; a.click();
      URL.revokeObjectURL(url);
    }
    setRitualState("scheduled");
  }

  async function resolve() {
    await apiFetch("/api/ritual", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId: report.subject.id, action: "resolve", resolvedBelief: "Canonical belief captured." }),
    });
    setRitualState("resolved");
    onChanged();
  }

  return (
    <div className={`rounded-2xl border bg-white shadow-card overflow-hidden transition-all ${critical ? "border-red-200" : "border-slate-200"} ${critical && !expanded ? "animate-pulseRing" : ""}`}>
      {/* header */}
      <button onClick={onToggle} className="w-full text-left p-5 cursor-pointer">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{report.subject.kind}</span>
              {critical && <IconAlert width={14} height={14} className="text-red-500" />}
            </div>
            <h3 className="mt-0.5 font-bold text-ink-900">{report.subject.title}</h3>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold" style={{ color }}>{pct(report.score)}</div>
            <div className="flex items-center justify-end gap-1 text-xs font-medium" style={{ color: report.trend < 0 ? "#ef4444" : "#10b981" }}>
              {report.trend < 0 ? <IconDown width={12} height={12} /> : <IconUp width={12} height={12} />}
              {report.trend >= 0 ? "+" : ""}{Math.round(report.trend * 100)}%
            </div>
          </div>
        </div>
        {/* bar */}
        <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: pct(report.score), background: color }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span style={{ color }}>{scoreLabel(report.score)}</span>
          <span>{report.beliefs.length} beliefs · {report.contradictions.length} conflict{report.contradictions.length !== 1 ? "s" : ""}</span>
        </div>
      </button>

      {/* expanded */}
      {expanded && (
        <div className="border-t border-slate-100 p-5 space-y-4 animate-floatUp">
          {report.beliefs.map((b) => <BeliefRow key={b.id} b={b} conflicting={report.contradictions.some((c) => c.a === b.id || c.b === b.id)} />)}

          {/* ritual */}
          {report.ritual && ritualState !== "resolved" && (
            <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <IconRitual width={16} height={16} /> Suggested resolution ritual
              </div>
              <p className="mt-1 text-sm text-ink-900 font-medium">{report.ritual.title}</p>
              <ul className="mt-2 space-y-1">
                {report.ritual.agenda.map((a, i) => (
                  <li key={i} className="text-xs text-slate-600 flex gap-2"><span className="text-primary">•</span>{a}</li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <button onClick={scheduleRitual} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600 transition-colors cursor-pointer">
                  Schedule (.ics) <IconArrow width={13} height={13} />
                </button>
                {ritualState === "scheduled" && (
                  <button onClick={resolve} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 text-emerald-700 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-50 transition-colors cursor-pointer">
                    Mark resolved <IconCheck width={13} height={13} />
                  </button>
                )}
              </div>
            </div>
          )}
          {ritualState === "resolved" && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
              <IconCheck width={16} height={16} /> Resolved. Outcome fed back into improve().
            </div>
          )}

          {/* feedback */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500">Was this alignment verdict useful?</span>
            <div className="flex gap-2">
              <button onClick={() => vote(1)} className={`p-1.5 rounded-md transition-colors cursor-pointer ${voted === 1 ? "bg-emerald-100 text-emerald-600" : "text-slate-400 hover:text-emerald-600"}`}><IconThumbUp width={16} height={16} /></button>
              <button onClick={() => vote(-1)} className={`p-1.5 rounded-md transition-colors cursor-pointer ${voted === -1 ? "bg-red-100 text-red-600" : "text-slate-400 hover:text-red-600"}`}><IconThumbDown width={16} height={16} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BeliefRow({ b, conflicting }: { b: EnrichedBelief; conflicting: boolean }) {
  const st = STANCE[String(b.stance) as keyof typeof STANCE];
  return (
    <div className={`rounded-xl border p-3 ${conflicting ? "border-red-200 bg-red-50/40" : "border-slate-200"}`}>
      <div className="flex items-center gap-2">
        <span className="grid place-items-center w-6 h-6 rounded-full text-[10px] font-bold text-white" style={{ background: b.holder.avatarColor }}>
          {b.holder.name.split(" ").map((n) => n[0]).join("")}
        </span>
        <span className="text-sm font-medium text-ink-900">{b.holder.name}</span>
        <span className="text-xs text-slate-400">{b.holder.role}</span>
        <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium ${st.cls}`}>{st.label}</span>
      </div>
      <p className="mt-1.5 text-sm text-slate-700">&ldquo;{b.proposition}&rdquo;</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <span>conf {Math.round(b.confidence * 100)}%</span>
        <span>·</span>
        {b.evidence.map((e, i) => <span key={i} className="underline decoration-dotted" title={e.excerpt}>{e.label} ({relDate(e.at)})</span>)}
      </div>
    </div>
  );
}
