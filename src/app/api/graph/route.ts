import { NextRequest, NextResponse } from "next/server";
import { BELIEFS, STAKEHOLDERS, SUBJECTS } from "@/lib/seed";
import { cogneeMode } from "@/lib/cognee";
import { align } from "@/lib/align";

export const runtime = "nodejs";

// Belief Graph Explorer data: nodes (stakeholders, subjects, beliefs, evidence)
// + edges (holds, about, evidenced-by, contradicts).
export async function GET(req: NextRequest) {
  const nodes: any[] = [];
  const edges: any[] = [];

  for (const s of STAKEHOLDERS) {
    nodes.push({ id: s.id, type: "stakeholder", label: s.name, meta: { role: s.role, team: s.team, alpha: s.feedbackAlpha, color: s.avatarColor } });
  }
  for (const s of SUBJECTS) {
    nodes.push({ id: s.id, type: "subject", label: s.title, meta: { kind: s.kind, score: align(s.id).score } });
  }
  for (const b of BELIEFS) {
    nodes.push({ id: b.id, type: "belief", label: b.proposition, meta: { stance: b.stance, confidence: b.confidence, at: b.assertedAt } });
    edges.push({ id: `e-hold-${b.id}`, source: b.holderId, target: b.id, label: "holds" });
    edges.push({ id: `e-about-${b.id}`, source: b.id, target: b.subjectId, label: "about" });
    for (const ev of b.evidence) {
      const evId = `ev-${ev.id}`;
      if (!nodes.find((n) => n.id === evId)) {
        nodes.push({ id: evId, type: "evidence", label: ev.label, meta: { source: ev.source, at: ev.at, excerpt: ev.excerpt } });
      }
      edges.push({ id: `e-evid-${b.id}-${ev.id}`, source: b.id, target: evId, label: "evidenced-by" });
    }
  }
  // contradiction edges
  for (const s of SUBJECTS) {
    for (const c of align(s.id).contradictions) {
      edges.push({ id: `e-contra-${c.a}-${c.b}`, source: c.a, target: c.b, label: "contradicts", contradiction: true });
    }
  }

  return NextResponse.json({ nodes, edges, cognee: cogneeMode(req.headers) });
}
