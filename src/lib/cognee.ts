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
// CREDENTIAL RESOLUTION (order of precedence):
//   1. Per-request credentials sent by the browser onboarding flow
//      via request headers  (X-Cognee-Base-Url / X-Cognee-Api-Key /
//      X-Cognee-Dataset).  This is what powers "bring your own key"
//      live data with zero redeploy.
//   2. Server env vars (COGNEE_BASE_URL / COGNEE_API_KEY / COGNEE_DATASET)
//      for teams that prefer configuring at deploy time.
//   3. When neither is present, every primitive gracefully degrades
//      to a local, deterministic mock so the whole product is runnable
//      offline (judges' reproducibility requirement).
//
// The API key NEVER reaches the client bundle: the browser holds it
// only in localStorage and forwards it per-request to our own
// server-side route, which is the only place the Cognee API is hit.
// Belief tuples are modelled as a custom Cognee DataPoint via node_set.
// ─────────────────────────────────────────────────────────────

import { BELIEFS, INGEST_DOCS } from "./seed";
import type { IngestDoc } from "./types";

const ENV_BASE_URL = process.env.COGNEE_BASE_URL?.replace(/\/$/, "") || "";
const ENV_API_KEY = process.env.COGNEE_API_KEY || "";
const ENV_DATASET = process.env.COGNEE_DATASET || "meridian-demo";

// Header names used by the onboarding flow (client → our server routes).
export const CRED_HEADERS = {
  baseUrl: "x-cognee-base-url",
  apiKey: "x-cognee-api-key",
  dataset: "x-cognee-dataset",
} as const;

export interface CogneeCreds {
  baseUrl: string;
  apiKey: string;
  dataset: string;
}

/**
 * Resolve the effective Cognee credentials for a single request.
 * Accepts a `Headers`/`Request` (App-Router routes) OR a plain creds
 * object.  Per-request values win; env vars are the fallback.
 */
export function resolveCreds(
  input?: Headers | Request | Partial<CogneeCreds> | null
): CogneeCreds {
  let hdrBase = "";
  let hdrKey = "";
  let hdrDataset = "";

  if (input) {
    if (input instanceof Request) input = input.headers;
    if (input instanceof Headers) {
      hdrBase = input.get(CRED_HEADERS.baseUrl)?.trim() || "";
      hdrKey = input.get(CRED_HEADERS.apiKey)?.trim() || "";
      hdrDataset = input.get(CRED_HEADERS.dataset)?.trim() || "";
    } else {
      const c = input as Partial<CogneeCreds>;
      hdrBase = (c.baseUrl || "").trim();
      hdrKey = (c.apiKey || "").trim();
      hdrDataset = (c.dataset || "").trim();
    }
  }

  return {
    baseUrl: (hdrBase || ENV_BASE_URL).replace(/\/$/, ""),
    apiKey: hdrKey || ENV_API_KEY,
    dataset: hdrDataset || ENV_DATASET,
  };
}

export function isConfigured(creds: CogneeCreds): boolean {
  return Boolean(creds.baseUrl && creds.apiKey);
}

export interface CogneeMode {
  configured: boolean;
  dataset: string;
  baseUrlHost: string | null;
  /** where the live creds came from — for the UI status badge */
  source: "request" | "env" | "none";
}

/**
 * Report the current memory mode. Pass request headers to reflect the
 * caller's own (browser-supplied) credentials; omit for env-only view.
 */
export function cogneeMode(
  input?: Headers | Request | Partial<CogneeCreds> | null
): CogneeMode {
  const creds = resolveCreds(input);
  const configured = isConfigured(creds);
  let host: string | null = null;
  try {
    host = creds.baseUrl ? new URL(creds.baseUrl).host : null;
  } catch {
    host = null;
  }
  // Determine source for the status badge.
  let source: CogneeMode["source"] = "none";
  if (configured) {
    // If env alone would satisfy it, it *could* be env; but a request
    // header that differs signals a request-scoped credential.
    const envConfigured = Boolean(ENV_BASE_URL && ENV_API_KEY);
    source = envConfigured && creds.baseUrl === ENV_BASE_URL && creds.apiKey === ENV_API_KEY ? "env" : "request";
  }
  return { configured, dataset: creds.dataset, baseUrlHost: host, source };
}

async function cogneeFetch<T>(creds: CogneeCreds, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${creds.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "X-Api-Key": creds.apiKey,
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
  opts: { sessionId?: string; selfImprovement?: boolean; creds?: CogneeCreds } = {}
): Promise<RememberResult> {
  const creds = opts.creds || resolveCreds();
  const nodeSet = doc.nodeSet;
  if (isConfigured(creds)) {
    try {
      await cogneeFetch(creds, "/api/v1/remember", {
        text: doc.transcript,
        dataset_name: creds.dataset,
        node_set: nodeSet,
        session_id: opts.sessionId,
        self_improvement: opts.selfImprovement ?? false,
        // Custom DataPoint hint — Belief extraction task tag.
        metadata: { doctype: "transcript", source: doc.source, subject_tags: nodeSet },
      });
      return { ok: true, mode: "cognee", dataset: creds.dataset, nodeSet, message: `Ingested "${doc.title}" into Cognee.` };
    } catch (e) {
      return { ok: false, mode: "cognee", dataset: creds.dataset, nodeSet, message: String(e) };
    }
  }
  // Mock: pretend to ingest.
  return {
    ok: true, mode: "mock", dataset: creds.dataset, nodeSet,
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
  opts: { searchType?: string; nodeName?: string[]; creds?: CogneeCreds } = {}
): Promise<RecallResult> {
  const creds = opts.creds || resolveCreds();
  if (isConfigured(creds)) {
    try {
      const data = await cogneeFetch<any>(creds, "/api/v1/recall", {
        query,
        datasets: [creds.dataset],
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
  opts: { sessionIds?: string[]; feedbackAlpha?: number; nodeName?: string[]; creds?: CogneeCreds } = {}
): Promise<ImproveResult> {
  const creds = opts.creds || resolveCreds();
  if (isConfigured(creds)) {
    try {
      await cogneeFetch(creds, "/api/v1/improve", {
        dataset: creds.dataset,
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
export async function forget(
  opts: { dataset?: string; everything?: boolean; creds?: CogneeCreds } = {}
): Promise<ForgetResult> {
  const creds = opts.creds || resolveCreds();
  const ds = opts.dataset || creds.dataset;
  const everything = opts.everything ?? false;
  if (isConfigured(creds)) {
    try {
      await cogneeFetch(creds, "/api/v1/forget", { dataset: ds, everything });
      return { mode: "cognee", message: `forget(${everything ? "everything" : ds}) sent to Cognee.` };
    } catch (e) {
      return { mode: "cognee", message: String(e) };
    }
  }
  return { mode: "mock", message: `[offline] Pruned dataset "${ds}".` };
}

/**
 * Lightweight connectivity probe used by the onboarding wizard's
 * "Test connection" step. Runs a tiny recall against the tenant and
 * reports success/failure without leaking the key back to the client.
 */
export async function testConnection(creds: CogneeCreds): Promise<{ ok: boolean; message: string; host: string | null }> {
  let host: string | null = null;
  try {
    host = creds.baseUrl ? new URL(creds.baseUrl).host : null;
  } catch {
    return { ok: false, message: "Invalid base URL.", host: null };
  }
  if (!isConfigured(creds)) {
    return { ok: false, message: "Base URL and API key are both required.", host };
  }
  try {
    await cogneeFetch(creds, "/api/v1/recall", {
      query: "What do you know from cognee?",
      datasets: [creds.dataset],
      search_type: "GRAPH_COMPLETION",
    });
    return { ok: true, message: `Connected to ${host}. Cognee memory is responding.`, host };
  } catch (e) {
    return { ok: false, message: `Could not reach Cognee: ${String(e).slice(0, 180)}`, host };
  }
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

export { INGEST_DOCS, ENV_DATASET as DATASET };
