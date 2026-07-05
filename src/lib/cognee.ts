// ─────────────────────────────────────────────────────────────
// Cognee client (SERVER-SIDE ONLY)
//
// Implements the four memory primitives against the Cognee Cloud
// REST API — remember(), recall(), improve(), forget() — exactly
// as shown in the project's Step-1/Step-2 credential flow:
//
//   POST {COGNEE_BASE_URL}/api/v1/recall
//   header: X-Api-Key: {COGNEE_API_KEY}
//
// When credentials are absent, every primitive gracefully degrades
// to a local, deterministic mock so the whole product is runnable
// offline (judges' reproducibility requirement). Belief tuples are
// modelled as a custom Cognee DataPoint via node_set tagging.
// ─────────────────────────────────────────────────────────────

import { BELIEFS, INGEST_DOCS } from "./seed";
import type { IngestDoc } from "./types";

const BASE_URL = process.env.COGNEE_BASE_URL?.replace(/\/$/, "") || "";
const API_KEY = process.env.COGNEE_API_KEY || "";
const DATASET = process.env.COGNEE_DATASET || "meridian-demo";

export const cogneeConfigured = Boolean(BASE_URL && API_KEY);

export interface CogneeMode {
  configured: boolean;
  dataset: string;
  baseUrlHost: string | null;
}

export function cogneeMode(): CogneeMode {
  let host: string | null = null;
  try {
    host = BASE_URL ? new URL(BASE_URL).host : null;
  } catch {
    host = null;
  }
  return { configured: cogneeConfigured, dataset: DATASET, baseUrlHost: host };
}

async function cogneeFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "X-Api-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    // Cognee heavy ops run in the background; keep the request short.
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cognee ${path} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ── remember() ────────────────────────────────────────────────
export interface RememberResult {
  ok: boolean;
  mode: "cognee" | "mock";
  dataset: string;
  nodeSet: string[];
  message: string;
}

export async function remember(
  doc: IngestDoc,
  opts: { sessionId?: string; selfImprovement?: boolean } = {}
): Promise<RememberResult> {
  const nodeSet = doc.nodeSet;
  if (cogneeConfigured) {
    try {
      await cogneeFetch("/api/v1/remember", {
        text: doc.transcript,
        dataset_name: DATASET,
        node_set: nodeSet,
        session_id: opts.sessionId,
        self_improvement: opts.selfImprovement ?? false,
        // Custom DataPoint hint — Belief extraction task tag.
        metadata: { doctype: "transcript", source: doc.source, subject_tags: nodeSet },
      });
      return { ok: true, mode: "cognee", dataset: DATASET, nodeSet, message: `Ingested "${doc.title}" into Cognee.` };
    } catch (e) {
      return { ok: false, mode: "cognee", dataset: DATASET, nodeSet, message: String(e) };
    }
  }
  // Mock: pretend to ingest.
  return {
    ok: true, mode: "mock", dataset: DATASET, nodeSet,
    message: `[offline] Normalized "${doc.title}" → belief tuples extracted, tagged ${nodeSet.join(", ")}.`,
  };
}

// ── recall() ──────────────────────────────────────────────────
export interface RecallHit {
  text: string;
  score: number;
  evidence: { label: string; source: string; at: string; excerpt?: string }[];
}
export interface RecallResult {
  mode: "cognee" | "mock";
  answer: string;
  hits: RecallHit[];
  route: "graph" | "vector" | "hybrid";
}

export async function recall(
  query: string,
  opts: { searchType?: string; nodeName?: string[] } = {}
): Promise<RecallResult> {
  if (cogneeConfigured) {
    try {
      const data = await cogneeFetch<any>("/api/v1/recall", {
        query,
        datasets: [DATASET],
        search_type: opts.searchType || "GRAPH_COMPLETION",
        node_name: opts.nodeName,
      });
      const rawHits: any[] = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      return {
        mode: "cognee",
        answer: data?.answer || data?.text || rawHits[0]?.text || "No answer returned.",
        route: (data?.route as any) || "hybrid",
        hits: rawHits.map((h) => ({
          text: h.text || h.content || String(h),
          score: h.score ?? 0.8,
          evidence: (h.evidence || []).map((e: any) => ({
            label: e.label || e.name || "source", source: e.source || "cognee", at: e.at || "", excerpt: e.excerpt,
          })),
        })),
      };
    } catch {
      // fall through to mock on error so the UI never dead-ends
    }
  }
  return mockRecall(query);
}

// ── improve() / memify ────────────────────────────────────────
export interface ImproveResult {
  mode: "cognee" | "mock";
  bridged: number;
  reweighted: number;
  pruned: number;
  message: string;
}

export async function improve(
  opts: { sessionIds?: string[]; feedbackAlpha?: number; nodeName?: string[] } = {}
): Promise<ImproveResult> {
  if (cogneeConfigured) {
    try {
      await cogneeFetch("/api/v1/improve", {
        dataset: DATASET,
        session_ids: opts.sessionIds,
        feedback_alpha: opts.feedbackAlpha,
        node_name: opts.nodeName,
        run_in_background: true,
      });
      return { mode: "cognee", bridged: opts.sessionIds?.length ?? 0, reweighted: 0, pruned: 0, message: "improve() dispatched to Cognee (background)." };
    } catch (e) {
      return { mode: "cognee", bridged: 0, reweighted: 0, pruned: 0, message: String(e) };
    }
  }
  return { mode: "mock", bridged: opts.sessionIds?.length ?? 1, reweighted: 4, pruned: 1, message: "[offline] Bridged session memory, reweighted 4 edges, pruned 1 stale belief." };
}

// ── forget() ──────────────────────────────────────────────────
export interface ForgetResult { mode: "cognee" | "mock"; message: string }
export async function forget(dataset?: string, everything = false): Promise<ForgetResult> {
  if (cogneeConfigured) {
    try {
      await cogneeFetch("/api/v1/forget", { dataset: dataset || DATASET, everything });
      return { mode: "cognee", message: `forget(${everything ? "everything" : dataset || DATASET}) sent to Cognee.` };
    } catch (e) {
      return { mode: "cognee", message: String(e) };
    }
  }
  return { mode: "mock", message: `[offline] Pruned dataset "${dataset || DATASET}".` };
}

// ── Offline recall over the seeded belief graph ───────────────
function mockRecall(query: string): RecallResult {
  const q = query.toLowerCase();
  const scored = BELIEFS.map((b) => {
    const hay = `${b.proposition}`.toLowerCase();
    let score = 0;
    for (const w of q.split(/\W+/).filter((w) => w.length > 2)) {
      if (hay.includes(w)) score += 1;
    }
    // small boost for evidence text matches
    for (const e of b.evidence) if ((e.excerpt || "").toLowerCase().includes(q.split(/\W+/)[0] || "")) score += 0.3;
    return { b, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const top = scored[0]?.b;
  const answer = top
    ? `Based on the belief graph: ${top.proposition} (held by ${top.holderId}, confidence ${(top.confidence * 100).toFixed(0)}%). Evidence traces back to ${top.evidence.map((e) => e.label).join("; ")}.`
    : "No belief in memory matches that query yet. Try ingesting more sources.";

  return {
    mode: "mock",
    route: "graph",
    answer,
    hits: scored.map(({ b, score }) => ({
      text: b.proposition,
      score: Math.min(0.99, 0.6 + score * 0.1),
      evidence: b.evidence.map((e) => ({ label: e.label, source: e.source, at: e.at, excerpt: e.excerpt })),
    })),
  };
}

export { INGEST_DOCS, DATASET };
