// Client-safe type re-exports (no server-only imports).
export type {
  ConstitutionAmendment,
  AlignmentReport,
  LintFinding,
  LintCategory,
  Belief,
  EnrichedBelief,
  Stakeholder,
  Subject,
  Ritual,
} from "./types";

export interface ImproveStep {
  name: string;
  detail: string;
}
