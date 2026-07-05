"use client";

import dynamic from "next/dynamic";
import PageHeader from "@/components/PageHeader";

const GraphExplorer = dynamic(() => import("@/components/GraphExplorer"), {
  ssr: false,
  loading: () => <div className="h-[calc(100vh-4rem)] grid place-items-center text-slate-400">Loading belief graph…</div>,
});

export default function GraphPage() {
  return (
    <>
      <PageHeader title="Belief Graph Explorer" subtitle="Stakeholders → Beliefs → Subjects → Evidence. Contradictions in red." />
      <GraphExplorer />
    </>
  );
}
