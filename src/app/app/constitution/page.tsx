"use client";

import { apiFetch } from "@/lib/credsClient";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import type { ConstitutionAmendment, ImproveStep } from "@/lib/clientTypes";
import { IconScroll, IconCheck, IconClose, IconSpark } from "@/components/icons";
import { relDate } from "@/lib/utils";

export default function ConstitutionPage() {
  const [amendments, setAmendments] = useState<ConstitutionAmendment[]>([]);
  const [improveResult, setImproveResult] = useState<{ steps: ImproveStep[]; mode: string } | null>(null);
  const [running, setRunning] = useState(false);

  async function load() {
    const r = await apiFetch("/api/constitution").then((r) => r.json());
    setAmendments(r.amendments);
  }
  useEffect(() => { load(); }, []);

  async function act(id: string, action: "approve" | "reject") {
    await apiFetch("/api/constitution", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    load();
  }

  async function runImprove() {
    setRunning(true);
    const r = await apiFetch("/api/improve", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json());
    setImproveResult({ steps: r.steps, mode: r.result?.mode });
    load();
    setRunning(false);
  }

  return (
    <>
      <PageHeader
        title="Alignment Constitution"
        subtitle="A self-rewriting document of how the org resolves conflict — the brain reasons about how it reasons"
        right={<button onClick={runImprove} disabled={running} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-600 px-3 py-2 text-sm font-semibold text-white hover:shadow-glow cursor-pointer disabled:opacity-50"><IconSpark width={16} height={16} /> {running ? "Running improve()…" : "Run nightly improve()"}</button>}
      />
      <div className="max-w-3xl mx-auto px-8 py-8">
        {/* improve loop output */}
        {improveResult && (
          <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 animate-floatUp">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-3">
              <IconSpark width={16} height={16} /> improve() loop complete
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${improveResult.mode === "cognee" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{improveResult.mode === "cognee" ? "live cognee" : "offline mock"}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {improveResult.steps.map((s, i) => (
                <div key={i} className="rounded-lg bg-white border border-slate-200 p-3">
                  <div className="text-xs font-bold text-ink-900">{i + 1}. {s.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.detail}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {amendments.map((a) => (
            <div key={a.id} className={`rounded-2xl border bg-white shadow-card p-5 ${a.status === "proposed" ? "border-meridian/40 ring-1 ring-meridian/20" : "border-slate-200"}`}>
              <div className="flex items-start gap-3">
                <span className="grid place-items-center w-9 h-9 rounded-lg bg-ink-900 text-white shrink-0"><IconScroll width={18} height={18} /></span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">v{a.version}</span>
                    <StatusBadge status={a.status} />
                    <span className="ml-auto text-[11px] text-slate-400">{relDate(a.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-ink-900 font-medium leading-relaxed">&ldquo;{a.rule}&rdquo;</p>
                  <p className="mt-1.5 text-sm text-slate-500">{a.rationale}</p>

                  {a.status === "proposed" && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-slate-500 mr-1">Human-approval gate:</span>
                      <button onClick={() => act(a.id, "approve")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"><IconCheck width={13} height={13} /> Approve</button>
                      <button onClick={() => act(a.id, "reject")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"><IconClose width={13} height={13} /> Reject</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-700",
    proposed: "bg-meridian/20 text-amber-700",
    rejected: "bg-red-100 text-red-600",
  };
  return <span className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${map[status]}`}>{status}</span>;
}
