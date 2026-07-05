// ─────────────────────────────────────────────────────────────
// The align() engine — the never-built core.
// Five-stage pipeline over the Stakeholder-Belief Graph:
//   1. Belief Gathering       (recall INSIGHTS by subject)
//   2. Canonicalization       (collapse near-duplicate props)
//   3. Contradiction Detection(stance-pair argumentation graph)
//   4. Alignment Scoring       (1 - weighted_conflict / total_mass)
//   5. Resolution Ritual        (proposed sync + agenda + evidence)
// ─────────────────────────────────────────────────────────────

import { BELIEFS, STAKEHOLDERS, SUBJECTS } from "./seed";
import type {
  AlignmentReport,
  Belief,
  Contradiction,
  EnrichedBelief,
  Ritual,
  Stakeholder,
  Subject,
} from "./types";

function stakeholder(id: string): Stakeholder {
  return STAKEHOLDERS.find((s) => s.id === id)!;
}

function enrich(b: Belief): EnrichedBelief {
  return { ...b, holder: stakeholder(b.holderId) };
}

/** Stage 2: naive canonicalization — cluster by stance + shared keywords. */
function canonicalize(beliefs: Belief[]): Belief[] {
  const keyword = (p: string) =>
    p.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter((w) => w.length > 3).slice(0, 4).sort().join("|");
  return beliefs.map((b) => ({ ...b, claimClusterId: `${b.stance}:${keyword(b.proposition)}` }));
}

/** Stage 3: build a Dung-style attack graph from opposing stances. */
function detectContradictions(beliefs: Belief[]): Contradiction[] {
  const out: Contradiction[] = [];
  for (let i = 0; i < beliefs.length; i++) {
    for (let j = i + 1; j < beliefs.length; j++) {
      const a = beliefs[i];
      const b = beliefs[j];
      // Opposing stance (one affirms, one contradicts) => attack edge.
      const opposing = a.stance * b.stance < 0;
      if (opposing) {
        const wa = a.confidence * stakeholder(a.holderId).feedbackAlpha;
        const wb = b.confidence * stakeholder(b.holderId).feedbackAlpha;
        out.push({
          a: a.id,
          b: b.id,
          reason: `${stakeholder(a.holderId).name} affirms while ${stakeholder(b.holderId).name} contradicts the canonical claim.`,
          weight: Math.min(wa, wb),
        });
      }
    }
  }
  return out;
}

/** Stage 4: AlignmentScore = 1 - weighted_conflict_mass / total_belief_mass. */
function scoreSubject(beliefs: Belief[], contradictions: Contradiction[]): number {
  const totalMass = beliefs.reduce(
    (s, b) => s + b.confidence * stakeholder(b.holderId).feedbackAlpha,
    0
  );
  if (totalMass === 0) return 1;
  const conflictMass = contradictions.reduce((s, c) => s + c.weight, 0);
  const score = 1 - conflictMass / totalMass;
  return Math.max(0, Math.min(1, score));
}

/** Stage 5: propose a resolution ritual for the top contradiction. */
function proposeRitual(subject: Subject, beliefs: Belief[], contradictions: Contradiction[]): Ritual | null {
  if (contradictions.length === 0) return null;
  const top = [...contradictions].sort((x, y) => y.weight - x.weight)[0];
  const ba = beliefs.find((b) => b.id === top.a)!;
  const bb = beliefs.find((b) => b.id === top.b)!;
  const pa = stakeholder(ba.holderId);
  const pb = stakeholder(bb.holderId);
  return {
    id: `ritual-${subject.id}-${Date.now()}`,
    subjectId: subject.id,
    participants: [pa.id, pb.id],
    title: `15-min ${pa.name.split(" ")[0]} ↔ ${pb.name.split(" ")[0]} sync on ${subject.title}`,
    agenda: [
      `Reconcile: "${ba.proposition}" vs "${bb.proposition}"`,
      `Review both evidence chains (attached below).`,
      `Decide the canonical belief and assign an owner.`,
      `Capture the resolved belief → feeds improve().`,
    ],
    evidenceChains: [ba.evidence, bb.evidence],
    status: "proposed",
    createdAt: new Date().toISOString(),
  };
}

// Previous scores (would be persisted; here derived to show a trend).
const PRIOR_SCORES: Record<string, number> = {
  "sub-pricing": 0.91,
  "sub-launch": 0.88,
  "sub-nrr": 0.97,
  "sub-sso": 0.9,
  "sub-activation": 0.8,
  "sub-datareg": 0.7,
};

export function align(subjectId: string): AlignmentReport {
  const subject = SUBJECTS.find((s) => s.id === subjectId)!;
  // Stage 1
  const raw = BELIEFS.filter((b) => b.subjectId === subjectId && !b.supersededById);
  // Stage 2
  const canon = canonicalize(raw);
  // Stage 3
  const contradictions = detectContradictions(canon);
  // Stage 4
  const score = scoreSubject(canon, contradictions);
  // Stage 5
  const ritual = proposeRitual(subject, canon, contradictions);

  const prior = PRIOR_SCORES[subjectId] ?? score;
  return {
    subject,
    score,
    beliefs: canon.map(enrich),
    contradictions,
    ritual,
    trend: score - prior,
  };
}

export function alignAll(): AlignmentReport[] {
  return SUBJECTS.map((s) => align(s.id)).sort((a, b) => a.score - b.score);
}
