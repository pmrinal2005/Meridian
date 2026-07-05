import type {
  Stakeholder,
  Subject,
  Belief,
  Ritual,
  ConstitutionAmendment,
  IngestDoc,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Seeded "Acme" company brain — a realistic, evidence-rich dataset
// that powers the offline demo AND is what gets pushed to Cognee
// via remember() when credentials are present.
// ─────────────────────────────────────────────────────────────

export const STAKEHOLDERS: Stakeholder[] = [
  { id: "sh-alice", name: "Alice Nguyen", role: "Sales", team: "Revenue", avatarColor: "#3B82F6", feedbackAlpha: 0.9 },
  { id: "sh-bob", name: "Bob Martinez", role: "Product", team: "Product", avatarColor: "#8B5CF6", feedbackAlpha: 1.15 },
  { id: "sh-carol", name: "Carol Okafor", role: "Engineering", team: "Platform", avatarColor: "#10b981", feedbackAlpha: 1.05 },
  { id: "sh-dan", name: "Dan Feldman", role: "Finance", team: "Finance", avatarColor: "#f59e0b", feedbackAlpha: 1.0 },
  { id: "sh-eve", name: "Eve Petrov", role: "Security", team: "Platform", avatarColor: "#ef4444", feedbackAlpha: 1.1 },
  { id: "sh-frank", name: "Frank Liu", role: "CEO", team: "Exec", avatarColor: "#0ea5e9", feedbackAlpha: 1.3 },
  { id: "sh-grace", name: "Grace Kim", role: "Marketing", team: "Growth", avatarColor: "#ec4899", feedbackAlpha: 0.95 },
];

export const SUBJECTS: Subject[] = [
  { id: "sub-pricing", title: "Q3 Pricing Model", kind: "decision", owner: "sh-bob" },
  { id: "sub-launch", title: "Nova Launch Date", kind: "roadmap", owner: "sh-bob" },
  { id: "sub-nrr", title: "Net Revenue Retention target", kind: "okr", owner: "sh-dan" },
  { id: "sub-sso", title: "Enterprise SSO scope", kind: "roadmap", owner: "sh-carol" },
  { id: "sub-activation", title: "Activation metric definition", kind: "metric", owner: "sh-bob" },
  { id: "sub-datareg", title: "EU Data Residency policy", kind: "policy", owner: "sh-eve" },
];

export const BELIEFS: Belief[] = [
  // --- Q3 Pricing: the flagship contradiction (91% -> 62%) ---
  {
    id: "b-1", holderId: "sh-alice", subjectId: "sub-pricing", stance: 1,
    proposition: "Q3 moves to usage-based pricing.",
    confidence: 0.91, assertedAt: "2026-06-12T15:20:00Z",
    evidence: [
      { id: "n-101", source: "slack", label: "Slack #pricing / T123", at: "2026-06-12T15:20:00Z", excerpt: "Told the Globex team we're going usage-based in Q3." },
      { id: "n-102", source: "granola", label: "Granola · Globex QBR 2026-06-12", at: "2026-06-12T14:00:00Z", excerpt: "Alice: 'usage-based lands Q3, you'll only pay for what you use.'" },
    ],
  },
  {
    id: "b-2", holderId: "sh-bob", subjectId: "sub-pricing", stance: -1,
    proposition: "Q3 keeps flat seat pricing; usage-based ships Q4.",
    confidence: 0.88, assertedAt: "2026-06-18T09:05:00Z",
    evidence: [
      { id: "n-103", source: "gdrive", label: "PRD-v3.md · Pricing", at: "2026-06-16T00:00:00Z", excerpt: "Q3: flat seat pricing unchanged. Usage-based = Q4 milestone." },
      { id: "n-104", source: "linear", label: "Linear PROD-441", at: "2026-06-18T09:05:00Z", excerpt: "Usage-based billing scoped for Q4 release train." },
    ],
  },
  {
    id: "b-3", holderId: "sh-dan", subjectId: "sub-pricing", stance: 0,
    proposition: "Pricing change needs finance model sign-off before external commitment.",
    confidence: 0.8, assertedAt: "2026-06-19T11:00:00Z",
    evidence: [{ id: "n-105", source: "email", label: "Email · Finance review", at: "2026-06-19T11:00:00Z", excerpt: "No external pricing commitments until the model is signed off." }],
  },

  // --- Nova Launch Date: mild drift ---
  {
    id: "b-4", holderId: "sh-bob", subjectId: "sub-launch", stance: 1,
    proposition: "Nova launches September 15.",
    confidence: 0.9, assertedAt: "2026-06-10T10:00:00Z",
    evidence: [{ id: "n-106", source: "notion", label: "Notion · Roadmap Q3", at: "2026-06-10T10:00:00Z", excerpt: "Nova GA target: Sep 15." }],
  },
  {
    id: "b-5", holderId: "sh-grace", subjectId: "sub-launch", stance: 1,
    proposition: "Nova launches September 15 (press embargo set).",
    confidence: 0.85, assertedAt: "2026-06-20T13:30:00Z",
    evidence: [{ id: "n-107", source: "slack", label: "Slack #marketing / T220", at: "2026-06-20T13:30:00Z", excerpt: "Press embargo locked for Sep 15." }],
  },
  {
    id: "b-6", holderId: "sh-carol", subjectId: "sub-launch", stance: -1,
    proposition: "Engineering can only commit to late September for Nova.",
    confidence: 0.82, assertedAt: "2026-06-24T16:45:00Z",
    evidence: [{ id: "n-108", source: "github", label: "GitHub · nova milestone", at: "2026-06-24T16:45:00Z", excerpt: "Burndown shows ~10 days slip; realistic GA Sep 26." }],
  },

  // --- NRR target: aligned ---
  {
    id: "b-7", holderId: "sh-dan", subjectId: "sub-nrr", stance: 1,
    proposition: "NRR target for the year is 120%.",
    confidence: 0.94, assertedAt: "2026-05-30T09:00:00Z",
    evidence: [{ id: "n-109", source: "gdrive", label: "Board deck · FY targets", at: "2026-05-30T09:00:00Z", excerpt: "NRR goal 120%." }],
  },
  {
    id: "b-8", holderId: "sh-frank", subjectId: "sub-nrr", stance: 1,
    proposition: "We committed 120% NRR to the board.",
    confidence: 0.96, assertedAt: "2026-05-31T18:00:00Z",
    evidence: [{ id: "n-110", source: "granola", label: "Granola · Board meeting", at: "2026-05-31T18:00:00Z", excerpt: "Frank: 120% NRR is the number." }],
  },

  // --- Enterprise SSO scope: interpretation drift ---
  {
    id: "b-9", holderId: "sh-alice", subjectId: "sub-sso", stance: 1,
    proposition: "Enterprise SSO includes SCIM auto-provisioning.",
    confidence: 0.78, assertedAt: "2026-06-14T12:00:00Z",
    evidence: [{ id: "n-111", source: "slack", label: "Slack #deals / T310", at: "2026-06-14T12:00:00Z", excerpt: "Promised SCIM provisioning to Initech as part of SSO." }],
  },
  {
    id: "b-10", holderId: "sh-carol", subjectId: "sub-sso", stance: 1,
    proposition: "Enterprise SSO means SAML login only (SCIM is a separate epic).",
    confidence: 0.83, assertedAt: "2026-06-15T10:20:00Z",
    evidence: [{ id: "n-112", source: "linear", label: "Linear PLAT-77", at: "2026-06-15T10:20:00Z", excerpt: "SSO = SAML. SCIM tracked separately in PLAT-91." }],
  },

  // --- Activation metric: silent commitment ---
  {
    id: "b-11", holderId: "sh-bob", subjectId: "sub-activation", stance: 1,
    proposition: "Activation = user completes 3 core actions in first 7 days.",
    confidence: 0.7, assertedAt: "2026-03-02T10:00:00Z",
    evidence: [{ id: "n-113", source: "notion", label: "Notion · Metrics glossary (old)", at: "2026-03-02T10:00:00Z", excerpt: "Activation: 3 core actions / 7 days." }],
  },

  // --- EU Data Residency: stakeholder blackout (no Security belief on sub-datareg beyond owner note) ---
  {
    id: "b-12", holderId: "sh-alice", subjectId: "sub-datareg", stance: 1,
    proposition: "We offer EU data residency to enterprise customers now.",
    confidence: 0.75, assertedAt: "2026-06-22T09:30:00Z",
    evidence: [{ id: "n-114", source: "slack", label: "Slack #deals / T355", at: "2026-06-22T09:30:00Z", excerpt: "Told Umbrella we already support EU residency." }],
  },
];

export const RITUALS: Ritual[] = [
  {
    id: "r-seed-1", subjectId: "sub-nrr",
    participants: ["sh-dan", "sh-frank"],
    title: "Confirm FY NRR number",
    agenda: ["Reconcile board commitment vs finance model"],
    evidenceChains: [],
    status: "resolved",
    resolvedBelief: "120% NRR confirmed as the committed target.",
    createdAt: "2026-06-01T09:00:00Z",
  },
];

export const CONSTITUTION: ConstitutionAmendment[] = [
  {
    id: "c-1", version: 1,
    rule: "Every subject must have a named owner (speaker) responsible for the canonical belief.",
    rationale: "Ownership orphans caused three re-litigated decisions last quarter.",
    status: "approved", createdAt: "2026-05-01T00:00:00Z",
  },
  {
    id: "c-2", version: 2,
    rule: "Sales pricing claims must be cross-checked against the current PRD before external commitment.",
    rationale: "Derived from the Q3 pricing misalignment between Sales and Product.",
    derivedFromRitual: "r-seed-1",
    status: "approved", createdAt: "2026-06-13T00:00:00Z",
  },
  {
    id: "c-3", version: 3,
    rule: "When Sales and Product disagree on pricing, treat the PRD as canonical unless the CEO has weighed in within 7 days.",
    rationale: "Proposed by improve() after the lowest-scoring pricing ritual.",
    status: "proposed", createdAt: "2026-06-25T00:00:00Z",
  },
];

// Transcript-shaped ingest docs (matches the hackathon normalization schema).
export const INGEST_DOCS: IngestDoc[] = [
  {
    id: "doc-globex-qbr", source: "granola", title: "Globex QBR",
    nodeSet: ["source:granola", "speaker:alice@acme.com", "subject:Q3 Pricing Model", "project:pricing"],
    at: "2026-06-12T14:00:00Z",
    transcript:
      "# Globex QBR\n[alice@acme.com, 2026-06-12T14:00] We're moving to usage-based pricing in Q3, you'll only pay for what you use.\n[globex@globex.com, 2026-06-12T14:05] Great, that fits our seasonality.",
  },
  {
    id: "doc-eng-standup", source: "slack", title: "#eng standup",
    nodeSet: ["source:slack", "slack:#eng", "speaker:bob@acme.com", "subject:Q3 Pricing Model", "project:pricing"],
    at: "2026-06-18T09:05:00Z",
    transcript:
      "# #eng standup\n[bob@acme.com, 2026-06-18T09:05] Reminder: Q3 keeps flat seat pricing. Usage-based is a Q4 milestone per PRD-v3.",
  },
];

// The "me:" personal-memory namespace demo (Theme 1: Personal Memory Agent).
export const PERSONAL_MEMORY: Record<string, { note: string; at: string }[]> = {
  "sh-frank": [
    { note: "I promised the board 120% NRR — hold the line on that.", at: "2026-05-31T18:00:00Z" },
    { note: "Watch the Q3 pricing story before the Globex renewal.", at: "2026-06-20T08:00:00Z" },
  ],
};
