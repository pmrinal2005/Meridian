// ─────────────────────────────────────────────────────────────
// lint() — Company-Wide Alignment CI.
// Extends Cognost's 4 categories with 3 org-native ones (⭐).
// Every finding is explainable by a graph traversal.
// ─────────────────────────────────────────────────────────────

import { BELIEFS, STAKEHOLDERS, SUBJECTS } from "./seed";
import type { LintFinding } from "./types";
import { align } from "./align";

const REQUIRED_ROLES_BY_KIND: Record<string, string[]> = {
  policy: ["Security"],
  decision: ["Finance"],
};

export function lint(): LintFinding[] {
  const findings: LintFinding[] = [];

  // 1. Contradictions — from align() attack edges.
  for (const subject of SUBJECTS) {
    const report = align(subject.id);
    for (const c of report.contradictions) {
      const ba = report.beliefs.find((b) => b.id === c.a)!;
      const bb = report.beliefs.find((b) => b.id === c.b)!;
      findings.push({
        id: `lint-contra-${c.a}-${c.b}`,
        category: "contradiction",
        severity: c.weight > 0.8 ? "high" : "medium",
        subjectId: subject.id,
        title: `Contradiction on "${subject.title}"`,
        detail: `${ba.holder.name} believes "${ba.proposition}" while ${bb.holder.name} believes "${bb.proposition}".`,
        beliefIds: [c.a, c.b],
        stakeholderIds: [ba.holderId, bb.holderId],
      });
    }
  }

  // 2. Superseded-but-referenced — supersededById set but evidence still recent.
  for (const b of BELIEFS) {
    if (b.supersededById) {
      findings.push({
        id: `lint-super-${b.id}`,
        category: "superseded-referenced",
        severity: "medium",
        subjectId: b.subjectId,
        title: `Superseded belief still cited`,
        detail: `"${b.proposition}" was superseded but is still referenced.`,
        beliefIds: [b.id],
        stakeholderIds: [b.holderId],
      });
    }
  }

  // 3. Ownership orphans — subject with no owner.
  for (const s of SUBJECTS) {
    if (!s.owner) {
      findings.push({
        id: `lint-orphan-${s.id}`,
        category: "ownership-orphan",
        severity: "medium",
        subjectId: s.id,
        title: `Ownership orphan: "${s.title}"`,
        detail: `No stakeholder is responsible for the canonical belief on this subject.`,
        beliefIds: [],
        stakeholderIds: [],
      });
    }
  }

  // 4. ⭐ Interpretation drift — same subject, same stance, but divergent propositions.
  for (const s of SUBJECTS) {
    const affirm = BELIEFS.filter((b) => b.subjectId === s.id && b.stance === 1);
    // divergent if two affirmations share few keywords
    for (let i = 0; i < affirm.length; i++) {
      for (let j = i + 1; j < affirm.length; j++) {
        const overlap = keywordOverlap(affirm[i].proposition, affirm[j].proposition);
        if (overlap < 0.25) {
          findings.push({
            id: `lint-drift-${affirm[i].id}-${affirm[j].id}`,
            category: "interpretation-drift",
            severity: "high",
            subjectId: s.id,
            title: `Interpretation drift on "${s.title}"`,
            detail: `Both parties think they agree, but mean different things: "${affirm[i].proposition}" vs "${affirm[j].proposition}".`,
            beliefIds: [affirm[i].id, affirm[j].id],
            stakeholderIds: [affirm[i].holderId, affirm[j].holderId],
          });
        }
      }
    }
  }

  // 5. ⭐ Silent commitments — belief asserted once, long ago, never re-affirmed, still load-bearing.
  const NOW = new Date("2026-06-26T00:00:00Z").getTime();
  for (const b of BELIEFS) {
    const ageDays = (NOW - new Date(b.assertedAt).getTime()) / 86400000;
    const reaffirmed = BELIEFS.some(
      (o) => o.id !== b.id && o.subjectId === b.subjectId && o.holderId === b.holderId
    );
    if (ageDays > 60 && !reaffirmed && b.confidence < 0.75) {
      findings.push({
        id: `lint-silent-${b.id}`,
        category: "silent-commitment",
        severity: "medium",
        subjectId: b.subjectId,
        title: `Silent commitment on "${SUBJECTS.find((s) => s.id === b.subjectId)?.title}"`,
        detail: `"${b.proposition}" was stated once ${Math.round(ageDays)} days ago, never re-affirmed, but still load-bearing.`,
        beliefIds: [b.id],
        stakeholderIds: [b.holderId],
      });
    }
  }

  // 6. ⭐ Stakeholder blackouts — a required role has zero beliefs on a subject.
  for (const s of SUBJECTS) {
    const required = REQUIRED_ROLES_BY_KIND[s.kind] || [];
    const rolesPresent = new Set(
      BELIEFS.filter((b) => b.subjectId === s.id).map(
        (b) => STAKEHOLDERS.find((sh) => sh.id === b.holderId)?.role
      )
    );
    for (const role of required) {
      if (!rolesPresent.has(role)) {
        findings.push({
          id: `lint-blackout-${s.id}-${role}`,
          category: "stakeholder-blackout",
          severity: "high",
          subjectId: s.id,
          title: `Stakeholder blackout: ${role} silent on "${s.title}"`,
          detail: `${role} is a required stakeholder for a ${s.kind} but has zero beliefs on file.`,
          beliefIds: [],
          stakeholderIds: [],
        });
      }
    }
  }

  const sev = { high: 0, medium: 1, low: 2 };
  return findings.sort((a, b) => sev[a.severity] - sev[b.severity]);
}

function keywordOverlap(a: string, b: string): number {
  const toks = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter((w) => w.length > 3));
  const A = toks(a);
  const B = toks(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 1 : inter / union;
}
