"use client";

import { apiFetch } from "@/lib/credsClient";
import { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MarkerType, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { relDate } from "@/lib/utils";

interface GNode { id: string; type: string; label: string; meta: any }
interface GEdge { id: string; source: string; target: string; label: string; contradiction?: boolean }

const TYPE_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  stakeholder: { bg: "#eff6ff", border: "#1E40AF", text: "#1e3a8a" },
  subject: { bg: "#fffbeb", border: "#d97706", text: "#78350f" },
  belief: { bg: "#ffffff", border: "#cbd5e1", text: "#0f1830" },
  evidence: { bg: "#f1f5f9", border: "#94a3b8", text: "#475569" },
};

// simple deterministic layout by type-column
function layout(nodes: GNode[]): Node[] {
  const cols: Record<string, number> = { stakeholder: 0, belief: 1, subject: 2, evidence: 3 };
  const counters: Record<string, number> = {};
  return nodes.map((n) => {
    const col = cols[n.type] ?? 1;
    counters[n.type] = (counters[n.type] || 0) + 1;
    const style = TYPE_STYLE[n.type] || TYPE_STYLE.belief;
    return {
      id: n.id,
      position: { x: col * 320, y: counters[n.type] * 92 },
      data: { label: renderLabel(n) },
      style: {
        background: style.bg, border: `2px solid ${style.border}`, color: style.text,
        borderRadius: 12, padding: 10, width: 260, fontSize: 12,
      },
    };
  });
}

function renderLabel(n: GNode): string {
  if (n.type === "stakeholder") return `👤 ${n.label} · ${n.meta.role}`.replace("👤 ", "");
  if (n.type === "subject") return `${n.label}\n(${Math.round((n.meta.score || 0) * 100)}% aligned)`;
  if (n.type === "evidence") return `${n.label}\n${relDate(n.meta.at)}`;
  const stance = n.meta.stance === 1 ? "＋" : n.meta.stance === -1 ? "✗" : "○";
  return `${stance} ${n.label}`;
}

export default function GraphExplorer() {
  const [data, setData] = useState<{ nodes: GNode[]; edges: GEdge[] } | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<GNode | null>(null);

  useEffect(() => {
    apiFetch("/api/graph").then((r) => r.json()).then(setData);
  }, []);

  const rf = useMemo(() => {
    if (!data) return { nodes: [] as Node[], edges: [] as Edge[] };
    let ns = data.nodes;
    if (typeFilter !== "all") {
      // keep the filtered type + directly connected nodes
      const keep = new Set(ns.filter((n) => n.type === typeFilter).map((n) => n.id));
      for (const e of data.edges) {
        if (keep.has(e.source)) keep.add(e.target);
        if (keep.has(e.target)) keep.add(e.source);
      }
      ns = ns.filter((n) => keep.has(n.id));
    }
    const nodes = layout(ns);
    const nodeIds = new Set(ns.map((n) => n.id));
    const edges: Edge[] = data.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({
        id: e.id, source: e.source, target: e.target, label: e.label,
        animated: e.contradiction,
        style: { stroke: e.contradiction ? "#ef4444" : "#cbd5e1", strokeWidth: e.contradiction ? 2.5 : 1.5 },
        labelStyle: { fontSize: 9, fill: e.contradiction ? "#ef4444" : "#94a3b8" },
        markerEnd: { type: MarkerType.ArrowClosed, color: e.contradiction ? "#ef4444" : "#cbd5e1" },
      }));
    return { nodes, edges };
  }, [data, typeFilter]);

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      {/* filter bar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2 bg-white/90 backdrop-blur rounded-xl border border-slate-200 p-2 shadow-card">
        {["all", "stakeholder", "belief", "subject", "evidence"].map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer ${typeFilter === t ? "bg-ink-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{t}</button>
        ))}
      </div>

      {/* legend — moved to bottom-RIGHT so it never overlaps the
          React Flow zoom/fit Controls (which live at bottom-left).
          This resolves the collision that was blocking zoom in/out. */}
      <div className="absolute bottom-6 right-4 z-10 bg-white/90 backdrop-blur rounded-xl border border-slate-200 p-3 shadow-card text-xs space-y-1.5">
        {Object.entries(TYPE_STYLE).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: v.bg, border: `2px solid ${v.border}` }} /><span className="capitalize text-slate-600">{k}</span></div>
        ))}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100"><span className="w-5 h-0.5 bg-red-500" /><span className="text-slate-600">contradicts</span></div>
      </div>

      <ReactFlow
        nodes={rf.nodes}
        edges={rf.edges}
        fitView
        minZoom={0.2}
        onNodeClick={(_, n) => setSelected(data?.nodes.find((d) => d.id === n.id) || null)}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={20} />
        {/* Pin the controls to bottom-left explicitly. The legend is now on
            the opposite side, so the zoom/fit buttons are always clickable. */}
        <Controls position="bottom-left" />
      </ReactFlow>

      {/* detail drawer */}
      {selected && (
        <div className="absolute top-4 right-4 z-10 w-80 bg-white rounded-xl border border-slate-200 shadow-card p-4 animate-floatUp">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{selected.type}</span>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer text-sm">✕</button>
          </div>
          <h3 className="mt-1 font-semibold text-ink-900 text-sm">{selected.label}</h3>
          <pre className="mt-3 text-[11px] text-slate-500 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-2">{JSON.stringify(selected.meta, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
