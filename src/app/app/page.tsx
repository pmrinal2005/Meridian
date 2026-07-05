"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { IconAsk, IconArrow, IconSpark } from "@/components/icons";
import { relDate } from "@/lib/utils";

interface Hit { text: string; score: number; evidence: { label: string; source: string; at: string; excerpt?: string }[] }
interface RecallResp { mode: string; answer: string; hits: Hit[]; route: string }

const SUGGESTIONS = [
  "What is our Q3 pricing model?",
  "When does Nova launch?",
  "What does Enterprise SSO include?",
  "What is our NRR target?",
];

const SOURCE_STYLE: Record<string, string> = {
  slack: "bg-purple-100 text-purple-700",
  granola: "bg-emerald-100 text-emerald-700",
  gdrive: "bg-blue-100 text-blue-700",
  github: "bg-slate-200 text-slate-700",
  linear: "bg-indigo-100 text-indigo-700",
  email: "bg-amber-100 text-amber-700",
  notion: "bg-neutral-200 text-neutral-700",
};

export default function AskPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<RecallResp | null>(null);

  async function ask(query: string) {
    if (!query.trim()) return;
    setQ(query);
    setLoading(true);
    setResp(null);
    try {
      const r = await fetch("/api/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, searchType: "GRAPH_COMPLETION" }),
      });
      setResp(await r.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Ask the Company Brain" subtitle="Evidence-first GraphRAG · every answer shows the belief chain" />
      <div className="max-w-4xl mx-auto px-8 py-10">
        {/* search */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-card p-2 flex items-center gap-2">
          <IconAsk width={20} height={20} className="text-slate-400 ml-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(q)}
            placeholder="Ask anything the org knows…"
            className="flex-1 bg-transparent outline-none px-2 py-2.5 text-ink-900 placeholder:text-slate-400"
          />
          <button
            onClick={() => ask(q)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:shadow-glow transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? "Recalling…" : "Recall"} <IconArrow width={16} height={16} />
          </button>
        </div>

        {/* suggestions */}
        {!resp && !loading && (
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-600 hover:border-primary hover:text-primary transition-colors cursor-pointer">
                {s}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="mt-8 space-y-3">
            <div className="h-24 rounded-2xl bg-slate-200/60 animate-pulse" />
            <div className="h-16 rounded-2xl bg-slate-200/40 animate-pulse" />
          </div>
        )}

        {/* answer */}
        {resp && (
          <div className="mt-8 animate-floatUp">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-card p-6">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                <IconSpark width={14} height={14} className="text-meridian" />
                <span className="uppercase tracking-widest">Answer · route: {resp.route}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${resp.mode === "cognee" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {resp.mode === "cognee" ? "live cognee" : "offline mock"}
                </span>
              </div>
              <p className="text-ink-900 leading-relaxed">{resp.answer}</p>
            </div>

            {/* belief chain */}
            {resp.hits.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-3">Belief chain · evidence</h3>
                <div className="space-y-3">
                  {resp.hits.map((h, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm text-ink-900 font-medium">{h.text}</p>
                        <span className="shrink-0 text-xs text-slate-400 font-mono">{Math.round(h.score * 100)}%</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {h.evidence.map((e, j) => (
                          <span key={j} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${SOURCE_STYLE[e.source] || "bg-slate-100 text-slate-600"}`} title={e.excerpt}>
                            <span className="font-medium">{e.label}</span>
                            {e.at && <span className="opacity-60">· {relDate(e.at)}</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
