// ─────────────────────────────────────────────────────────────
// Meridian core domain types
// The Belief Tuple is the secret sauce on top of Cognee's default
// extraction. It is registered as a custom Cognee DataPoint type.
// ─────────────────────────────────────────────────────────────

export type Stance = 1 | 0 | -1; // affirms | neutral | contradicts

export type SourceType =
  | "slack"
  | "granola"
  | "gdrive"
  | "github"
  | "linear"
  | "email"
  | "notion";

/** A reference to a piece of provenance stored in the Cognee graph. */
export interface SourceRef {
  id: string; // Cognee node id
  source: SourceType;
  label: string; // human label e.g. "Slack #pricing / T123"
  url?: string;
  excerpt?: string;
  at: string; // ISO timestamp
}

/** A person, team, or agent whose beliefs we track. */
export interface Stakeholder {
  id: string;
  name: string;
  role: string; // e.g. "Sales", "Product", "Security"
  team: string;
  avatarColor: string;
  /** Reliability weight, adapted by improve() from past resolved rituals. */
  feedbackAlpha: number;
}

/** A subject that stakeholders hold beliefs about (decision, OKR, metric, roadmap item). */
export interface Subject {
  id: string;
  title: string;
  kind: "decision" | "okr" | "metric" | "roadmap" | "policy";
  owner?: string; // stakeholder id
}

/**
 * The Stakeholder-Belief Tuple:
 * (who, claims, about, at-time, evidence, confidence)
 */
export interface Belief {
  id: string;
  holderId: string; // Stakeholder
  proposition: string; // canonicalized statement
  subjectId: string; // Subject the belief is about
  stance: Stance;
  evidence: SourceRef[];
  assertedAt: string; // ISO timestamp
  confidence: number; // 0..1 extraction confidence
  supersededById?: string; // temporal chain
  /** Optional canonical-claim cluster id assigned in align() stage 2. */
  claimClusterId?: string;
}

/** A detected contradiction between two beliefs (align stage 3). */
export interface Contradiction {
  a: string; // belief id
  b: string; // belief id
  reason: string;
  weight: number; // weighted conflict mass
}

/** A proposed alignment ritual (align stage 5). */
export interface Ritual {
  id: string;
  subjectId: string;
  participants: string[]; // stakeholder ids
  title: string;
  agenda: string[];
  evidenceChains: SourceRef[][];
  status: "proposed" | "scheduled" | "resolved";
  resolvedBelief?: string;
  createdAt: string;
}

/** Output of align() for a subject. */
export interface AlignmentReport {
  subject: Subject;
  score: number; // 0..1
  beliefs: EnrichedBelief[];
  contradictions: Contradiction[];
  ritual: Ritual | null;
  trend: number; // delta vs previous score, e.g. -0.29
}

export interface EnrichedBelief extends Belief {
  holder: Stakeholder;
}

/** Lint finding categories — 4 from Cognost + 3 org-native (starred). */
export type LintCategory =
  | "contradiction"
  | "superseded-referenced"
  | "ownership-orphan"
  | "interpretation-drift" // ⭐ new
  | "silent-commitment" // ⭐ new
  | "stakeholder-blackout"; // ⭐ new

export interface LintFinding {
  id: string;
  category: LintCategory;
  severity: "high" | "medium" | "low";
  subjectId?: string;
  title: string;
  detail: string;
  beliefIds: string[];
  stakeholderIds: string[];
}

/** A versioned amendment to the Alignment Constitution. */
export interface ConstitutionAmendment {
  id: string;
  version: number;
  rule: string;
  rationale: string;
  derivedFromRitual?: string;
  status: "proposed" | "approved" | "rejected";
  createdAt: string;
}

/** A raw ingested document (transcript-shaped, matching hackathon schema). */
export interface IngestDoc {
  id: string;
  source: SourceType;
  title: string;
  nodeSet: string[]; // tags: source:X, speaker:Y, subject:Z, project:P
  transcript: string;
  at: string;
}

/** Feedback event captured on an align() verdict or ritual outcome. */
export interface FeedbackEvent {
  id: string;
  targetType: "alignment" | "ritual" | "constitution";
  targetId: string;
  vote: 1 | -1;
  at: string;
}
