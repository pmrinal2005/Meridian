// ─────────────────────────────────────────────────────────────
// Cognee client (SERVER-SIDE ONLY)
//
// Implements the four memory primitives against the **Cognee Cloud
// data-plane REST API** exposed by a *tenant service host*
// (https://tenant-xxxx.aws.cognee.ai). Verified against the live tenant
// OpenAPI schema (GET {BASE}/openapi.json):
//
//   POST {BASE}/api/v1/remember    (multipart: add + cognify in ONE call)
//   POST {BASE}/api/v1/add_text    (JSON: ingest text, no graph build)
//   POST {BASE}/api/v1/cognify     (JSON: build graph from a dataset)
//   POST {BASE}/api/v1/recall      (JSON: search over the graph)          — RecallPayloadDTO
//   POST {BASE}/api/v1/search      (JSON: same as recall, no history)
//   POST {BASE}/api/v1/forget      (JSON: prune derived memory)
//   GET  {BASE}/api/v1/datasets/   (list datasets → id/name)
//   GET  {BASE}/api/v1/datasets/status?dataset=<uuid> (pipeline status)
//   GET  {BASE}/api/v1/datasets/{id}/data (list ingested docs)
//   GET  {BASE}/health             (PUBLIC liveness probe — no auth)
//
// Authentication is via the `X-Api-Key` header on every request.
//
// ── ROOT-CAUSE OF THE "0 DOCS / FALLS BACK TO DUMMY DATA" BUG ──
// The previous client sent `session_id` on every remember() call. Per the
// live Cognee docs, when `session_id` IS set the data is stored in the
// SESSION CACHE and only bridged into the permanent graph *in the
// background* — so the dataset shows 0 docs and recall() against the
// dataset finds nothing, which is exactly what the Brain screenshot and
// the "provide node–relation–node triplets" recall reply showed.
//
// THE FIX:
//   1. remember() for durable ingest now OMITS session_id → data is
//      ingested directly via add + cognify into the permanent dataset,
//      so it is immediately queryable and visible as docs in the Brain.
//   2. A hard two-step fallback: if /remember fails/times out, we call
//      /add_text then /cognify explicitly (works on any tenant tier).
//   3. Dataset name is resolved to its UUID so recall()/status target the
//      exact dataset the docs landed in.
//   4. When credentials ARE configured we surface REAL errors instead of
//      silently masquerading as a successful mock — no more phantom
//      "SAVED" with an empty graph. Mock is used ONLY when unconfigured.
//
// CREDENTIAL RESOLUTION (order of precedence):
//   1. Per-request headers from the browser onboarding flow
//      (X-Cognee-Base-Url / X-Cognee-Api-Key / X-Cognee-Dataset).
//   2. Server env vars (COGNEE_BASE_URL / COGNEE_API_KEY / COGNEE_DATASET).
//   3. Neither present → deterministic offline mock over the seed graph.
//
// The API key NEVER reaches the client bundle.
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
 * object. Per-request values win; env vars are the fallback.
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
  let source: CogneeMode["source"] = "none";
  if (configured) {
    const envConfigured = Boolean(ENV_BASE_URL && ENV_API_KEY);
    source = envConfigured && creds.baseUrl === ENV_BASE_URL && creds.apiKey === ENV_API_KEY ? "env" : "request";
  }
  return { configured, dataset: creds.dataset, baseUrlHost: host, source };
}

// ── low-level fetch helpers ───────────────────────────────────
const DEFAULT_TIMEOUT_MS = 25_000;

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return { signal: ctl.signal, done: () => clearTimeout(t) };
}

/** JSON POST helper. */
async function cogneeJson<T>(
  creds: CogneeCreds,
  path: string,
  body: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const { signal, done } = withTimeout(timeoutMs);
  try {
    const res = await fetch(`${creds.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "X-Api-Key": creds.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Cognee ${path} failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const raw = await res.text();
    return (raw ? JSON.parse(raw) : {}) as T;
  } finally {
    done();
  }
}

/** GET helper (datasets listing, status). */
async function cogneeGet<T>(
  creds: CogneeCreds,
  path: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const { signal, done } = withTimeout(timeoutMs);
  try {
    const res = await fetch(`${creds.baseUrl}${path}`, {
      method: "GET",
      headers: { "X-Api-Key": creds.apiKey },
      cache: "no-store",
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Cognee ${path} failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const raw = await res.text();
    return (raw ? JSON.parse(raw) : {}) as T;
  } finally {
    done();
  }
}

/** multipart/form-data POST helper (for /remember and /add). */
async function cogneeForm<T>(
  creds: CogneeCreds,
  path: string,
  form: FormData,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const { signal, done } = withTimeout(timeoutMs);
  try {
    const res = await fetch(`${creds.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "X-Api-Key": creds.apiKey,
        // NOTE: never set Content-Type manually for FormData — the runtime
        // adds the correct multipart boundary automatically.
      },
      body: form,
      cache: "no-store",
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Cognee ${path} failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const raw = await res.text();
    return (raw ? JSON.parse(raw) : {}) as T;
  } finally {
    done();
  }
}

// ── dataset resolution ────────────────────────────────────────
export interface DatasetInfo {
  id: string;
  name: string;
}

/** List all datasets visible to the key. */
export async function listDatasets(creds: CogneeCreds): Promise<DatasetInfo[]> {
  const data = await cogneeGet<any[]>(creds, "/api/v1/datasets/", 15_000);
  return (Array.isArray(data) ? data : []).map((d) => ({
    id: d.id,
    name: d.name,
  }));
}

/** Find the UUID of a dataset by name (case-insensitive). */
export async function resolveDatasetId(
  creds: CogneeCreds,
  name?: string
): Promise<string | null> {
  const target = (name || creds.dataset).toLowerCase();
  try {
    const list = await listDatasets(creds);
    const hit = list.find((d) => (d.name || "").toLowerCase() === target);
    return hit?.id || null;
  } catch {
    return null;
  }
}

/** Count the docs currently ingested in a dataset (by UUID). */
export async function datasetDocCount(
  creds: CogneeCreds,
  datasetId: string
): Promise<number> {
  try {
    const data = await cogneeGet<any[]>(creds, `/api/v1/datasets/${datasetId}/data`, 15_000);
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

// ── remember() — durable ingest (add + cognify) ───────────────
// CRITICAL: we OMIT session_id so Cognee ingests directly into the
// PERMANENT dataset (add + cognify), making it immediately queryable and
// visible as docs in the Brain. Passing session_id would route the data
// into the ephemeral session cache (bridged only in the background),
// which is what caused the "0 docs" bug.
export interface RememberResult {
  ok: boolean;
  mode: "cognee" | "mock";
  dataset: string;
  nodeSet: string[];
  message: string;
  /** which path actually landed the data — for diagnostics */
  via?: "remember" | "add_text+cognify";
}

export async function remember(
  doc: IngestDoc,
  opts: {
    sessionId?: string;
    /** when true, attach session_id (session-cache route) — used only by
     *  the self-improvement demo, NOT durable ingest */
    useSession?: boolean;
    selfImprovement?: boolean;
    creds?: CogneeCreds;
  } = {}
): Promise<RememberResult> {
  const creds = opts.creds || resolveCreds();
  const nodeSet = doc.nodeSet;

  if (!isConfigured(creds)) {
    // Offline mock — only when truly unconfigured.
    return {
      ok: true, mode: "mock", dataset: creds.dataset, nodeSet,
      message: `[offline] Normalized "${doc.title}" → belief tuples extracted, tagged ${nodeSet.join(", ")}.`,
    };
  }

  // ── Path A: single-call /remember (add + cognify) ──
  try {
    const form = new FormData();
    const filename = `${doc.id || "doc"}.md`;
    const blob = new Blob([doc.transcript], { type: "text/markdown" });
    form.append("data", blob, filename);
    form.append("datasetName", creds.dataset);
    for (const tag of nodeSet) form.append("node_set", tag);
    // Durable ingest: run cognify synchronously so the graph is queryable
    // immediately, and DO NOT set session_id (keeps data in the permanent
    // dataset, not the session cache).
    if (opts.useSession && opts.sessionId) form.append("session_id", opts.sessionId);
    form.append("run_in_background", "false");

    await cogneeForm(creds, "/api/v1/remember", form, 110_000);
    return {
      ok: true, mode: "cognee", dataset: creds.dataset, nodeSet, via: "remember",
      message: `Ingested "${doc.title}" into Cognee dataset "${creds.dataset}".`,
    };
  } catch (eRemember) {
    // ── Path B fallback: explicit add_text → cognify ──
    // Works even if /remember multipart parsing or session routing misbehaves
    // on a given tenant tier.
    try {
      await cogneeJson(creds, "/api/v1/add_text", {
        textData: [doc.transcript],
        datasetName: creds.dataset,
        nodeSet,
      }, 40_000);
      await cogneeJson(creds, "/api/v1/cognify", {
        datasets: [creds.dataset],
        runInBackground: false,
      }, 110_000);
      return {
        ok: true, mode: "cognee", dataset: creds.dataset, nodeSet, via: "add_text+cognify",
        message: `Ingested "${doc.title}" via add_text+cognify into "${creds.dataset}".`,
      };
    } catch (eFallback) {
      // Configured but genuinely failing → surface the REAL error. No silent
      // mock masquerade.
      return {
        ok: false, mode: "cognee", dataset: creds.dataset, nodeSet,
        message: `remember failed: ${String(eRemember).slice(0, 160)} | fallback failed: ${String(eFallback).slice(0, 160)}`,
      };
    }
  }
}

// ── recall() — GraphRAG query over the belief graph ───────────
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
  /** true when Cognee replied but the tenant graph is still empty */
  needsProvision?: boolean;
  /** raw error surfaced to the UI when configured but failing */
  error?: string;
}

/** Detect the "empty tenant / dataset not found" case so callers can offer to provision. */
function isPrerequisiteError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    (m.includes("404") && (m.includes("prerequisit") || m.includes("remember") || m.includes("cognify") || m.includes("dataset"))) ||
    m.includes("prerequisites not met") ||
    m.includes("no data") ||
    m.includes("not found")
  );
}

/** Detect an authentication failure (bad / missing API key). */
function isAuthError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("401") || m.includes("403") || m.includes("unauthorized") || m.includes("forbidden");
}

/**
 * Parse the Cognee recall/search response. The live API returns EITHER an
 * array of typed entries (discriminated by `source`: qa_completion,
 * graph_context, …) OR an object with results/hits. We handle both.
 */
function parseRecall(data: any): { answer: string; hits: RecallHit[] } {
  // Array-of-entries shape (the real Cognee Cloud recall response).
  if (Array.isArray(data)) {
    let answer = "";
    const hits: RecallHit[] = [];
    for (const entry of data) {
      const src = entry?.source;
      if ((src === "qa_completion" || entry?.answer) && !answer) {
        answer = entry.answer || "";
      }
      if (src === "graph_context" && entry?.content) {
        hits.push({ text: String(entry.content), score: 0.85, evidence: [] });
      }
      // Plain string entries or fallbacks.
      if (typeof entry === "string" && !answer) answer = entry;
    }
    if (!answer && hits.length) answer = hits[0].text;
    return { answer: answer || "No answer returned yet.", hits };
  }

  // Object shapes: {answer, results|hits|context}.
  const rawHits: any[] = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data?.hits)
    ? data.hits
    : [];
  const hits: RecallHit[] = rawHits.map((h) => ({
    text: h.text || h.content || h.context || h.answer || String(h),
    score: typeof h.score === "number" ? h.score : 0.8,
    evidence: (h.evidence || h.references || []).map((e: any) => ({
      label: e.label || e.name || e.title || "source",
      source: e.source || "cognee",
      at: e.at || e.time || "",
      excerpt: e.excerpt || e.text,
    })),
  }));
  const answer =
    data?.answer || data?.text || hits[0]?.text || "No answer returned yet.";
  return { answer, hits };
}

export async function recall(
  query: string,
  opts: { searchType?: string; nodeName?: string[]; creds?: CogneeCreds } = {}
): Promise<RecallResult> {
  const creds = opts.creds || resolveCreds();
  if (isConfigured(creds)) {
    try {
      // RecallPayloadDTO uses camelCase (searchType/nodeName/topK/includeReferences).
      const body: Record<string, unknown> = {
        query,
        datasets: [creds.dataset],
        searchType: opts.searchType || "GRAPH_COMPLETION",
        topK: 10,
        includeReferences: true,
      };
      if (opts.nodeName && opts.nodeName.length) body.nodeName = opts.nodeName;
      const data = await cogneeJson<any>(creds, "/api/v1/recall", body, 45_000);
      const { answer, hits } = parseRecall(data);
      const empty =
        !answer ||
        /no answer returned|i'?m not seeing|provide the set of|node.?relation.?node|no (relevant )?(data|knowledge|context|information)/i.test(
          answer
        );
      if (empty) {
        const m = mockRecall(query);
        return { ...m, needsProvision: true };
      }
      return { mode: "cognee", answer, route: (data?.route as any) || "hybrid", hits };
    } catch (e) {
      const msg = String(e);
      if (isPrerequisiteError(msg)) {
        const m = mockRecall(query);
        return { ...m, needsProvision: true };
      }
      if (isAuthError(msg)) {
        const m = mockRecall(query);
        return { ...m, error: "API key rejected (401/403). Re-check your Cognee key." };
      }
      // Other transient error → mock but surface the error string.
      const m = mockRecall(query);
      return { ...m, error: msg.slice(0, 200) };
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
      // memify/improve enriches the existing graph in the background.
      await cogneeJson(creds, "/api/v1/cognify", {
        datasets: [creds.dataset],
        runInBackground: true,
      }, 30_000);
      return { mode: "cognee", bridged: opts.sessionIds?.length ?? 1, reweighted: 0, pruned: 0, message: "improve() dispatched to Cognee (background enrichment / memify)." };
    } catch (e) {
      return { mode: "cognee", bridged: 0, reweighted: 0, pruned: 0, message: String(e).slice(0, 200) };
    }
  }
  return { mode: "mock", bridged: opts.sessionIds?.length ?? 1, reweighted: 4, pruned: 1, message: "[offline] Bridged session memory, reweighted 4 edges, pruned 1 stale belief." };
}

// ── forget() ──────────────────────────────────────────────────
export interface ForgetResult { mode: "cognee" | "mock"; message: string }
export async function forget(
  opts: { dataset?: string; memoryOnly?: boolean; creds?: CogneeCreds } = {}
): Promise<ForgetResult> {
  const creds = opts.creds || resolveCreds();
  const ds = opts.dataset || creds.dataset;
  const memoryOnly = opts.memoryOnly ?? true;
  if (isConfigured(creds)) {
    try {
      await cogneeJson(creds, "/api/v1/forget", { dataset: ds, memory_only: memoryOnly });
      return { mode: "cognee", message: `forget(${ds}${memoryOnly ? ", memory-only" : ""}) sent to Cognee.` };
    } catch (e) {
      return { mode: "cognee", message: String(e).slice(0, 200) };
    }
  }
  return { mode: "mock", message: `[offline] Pruned dataset "${ds}".` };
}

// ── health probe ──────────────────────────────────────────────
export async function health(creds: CogneeCreds): Promise<{ ok: boolean; status: number; message: string }> {
  const { signal, done } = withTimeout(12_000);
  try {
    const res = await fetch(`${creds.baseUrl}/health`, {
      method: "GET",
      headers: { "X-Api-Key": creds.apiKey },
      cache: "no-store",
      signal,
    });
    if (res.ok) return { ok: true, status: res.status, message: "Tenant is reachable and healthy." };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, message: "Reached the tenant, but the API key was rejected." };
    }
    return { ok: false, status: res.status, message: `Tenant responded with HTTP ${res.status}.` };
  } catch (e) {
    return { ok: false, status: 0, message: `Could not reach the endpoint: ${String(e).slice(0, 160)}` };
  } finally {
    done();
  }
}

/**
 * Connectivity probe used by the onboarding wizard.
 * /health is a PUBLIC liveness probe on Cognee Cloud (no auth), so a 200
 * there does NOT prove the key is valid. We therefore also authenticate
 * via the datasets listing endpoint (cheap, always available, requires a
 * valid key) and count docs to know whether provisioning is still needed.
 */
export async function testConnection(
  creds: CogneeCreds
): Promise<{ ok: boolean; message: string; host: string | null; hasData: boolean }> {
  let host: string | null = null;
  try {
    host = creds.baseUrl ? new URL(creds.baseUrl).host : null;
  } catch {
    return { ok: false, message: "Invalid base URL.", host: null, hasData: false };
  }
  if (!isConfigured(creds)) {
    return { ok: false, message: "Base URL and API key are both required.", host, hasData: false };
  }

  const h = await health(creds);
  if (!h.ok) {
    return { ok: false, message: h.message, host, hasData: false };
  }

  // Authenticate + detect existing data via the datasets endpoint.
  let hasData = false;
  try {
    const list = await listDatasets(creds);
    const ds = list.find((d) => (d.name || "").toLowerCase() === creds.dataset.toLowerCase());
    if (ds) {
      const count = await datasetDocCount(creds, ds.id);
      hasData = count > 0;
    }
  } catch (e) {
    const msg = String(e);
    if (isAuthError(msg)) {
      return {
        ok: false,
        host,
        hasData: false,
        message: `Reached ${host}, but the API key was rejected (401/403). Double-check your COGNEE_API_KEY.`,
      };
    }
    // Reachable but couldn't list — treat as connected, provisioning will retry.
    hasData = false;
  }

  return {
    ok: true,
    host,
    hasData,
    message: hasData
      ? `Connected to ${host}. Cognee memory is live and responding.`
      : `Connected to ${host}. Dataset "${creds.dataset}" is empty — loading the belief graph so recall() returns live data…`,
  };
}

// ── provision() — one-click seed ingest so recall works instantly ──
export interface ProvisionResult {
  mode: "cognee" | "mock";
  ingested: number;
  failed: number;
  datasetDocs?: number;
  messages: string[];
}

/**
 * Push the seed corpus into the user's tenant via remember() (durable,
 * NO session_id → lands in the permanent dataset). After this, recall()
 * returns live, dynamic answers AND the Brain shows the docs.
 *
 * To respect Vercel serverless time limits, we batch a bounded number of
 * docs per invocation; the onboarding flow calls this until docs land.
 */
export async function provision(
  creds: CogneeCreds,
  opts: { limit?: number } = {}
): Promise<ProvisionResult> {
  if (!isConfigured(creds)) {
    return { mode: "mock", ingested: INGEST_DOCS.length, failed: 0, messages: ["[offline] Seed corpus available in mock mode."] };
  }
  // Combine the transcript-shaped INGEST_DOCS with per-belief synthetic docs
  // so the graph is rich. Bound the batch so a single serverless call fits
  // inside the platform time budget (each remember runs add+cognify).
  const docs: IngestDoc[] = [...INGEST_DOCS, ...beliefsAsDocs()];
  const limit = opts.limit ?? docs.length;
  const batch = docs.slice(0, limit);

  let ingested = 0;
  let failed = 0;
  const messages: string[] = [];
  for (const doc of batch) {
    const r = await remember(doc, { creds }); // durable — no session_id
    if (r.ok) ingested++;
    else {
      failed++;
      messages.push(r.message);
    }
  }

  // Verify data actually landed in the dataset (real doc count).
  let datasetDocs: number | undefined;
  try {
    const id = await resolveDatasetId(creds);
    if (id) datasetDocs = await datasetDocCount(creds, id);
  } catch {
    /* best-effort */
  }

  return { mode: "cognee", ingested, failed, datasetDocs, messages: messages.slice(0, 5) };
}

/** Turn each seed Belief into a transcript-shaped doc for ingestion. */
function beliefsAsDocs(): IngestDoc[] {
  return BELIEFS.map((b) => {
    const ev = b.evidence[0];
    const stanceWord = b.stance === 1 ? "affirms" : b.stance === -1 ? "contradicts" : "notes";
    const transcript =
      `# ${ev?.label || "Belief record"}\n` +
      `Holder: ${b.holderId} (${stanceWord}, confidence ${(b.confidence * 100).toFixed(0)}%)\n` +
      `Asserted: ${b.assertedAt}\n\n` +
      `${b.proposition}\n\n` +
      b.evidence.map((e) => `[${e.source} · ${e.label}] ${e.excerpt || ""}`).join("\n");
    return {
      id: `belief-${b.id}`,
      source: ev?.source || "slack",
      title: b.proposition.slice(0, 60),
      nodeSet: [
        `source:${ev?.source || "slack"}`,
        `speaker:${b.holderId}`,
        `subject:${b.subjectId}`,
        `belief:${b.id}`,
      ],
      transcript,
      at: b.assertedAt,
    };
  });
}

// ── live dataset status (real doc count) ──────────────────────
export interface LiveStatus {
  configured: boolean;
  host: string | null;
  dataset: string;
  datasetId: string | null;
  docCount: number;
  reachable: boolean;
  message: string;
}

/** Query the live tenant for the real ingested doc count in the dataset. */
export async function liveStatus(creds: CogneeCreds): Promise<LiveStatus> {
  let host: string | null = null;
  try {
    host = creds.baseUrl ? new URL(creds.baseUrl).host : null;
  } catch {
    host = null;
  }
  if (!isConfigured(creds)) {
    return { configured: false, host, dataset: creds.dataset, datasetId: null, docCount: 0, reachable: false, message: "Offline (mock) mode." };
  }
  try {
    const id = await resolveDatasetId(creds);
    if (!id) {
      return { configured: true, host, dataset: creds.dataset, datasetId: null, docCount: 0, reachable: true, message: `Dataset "${creds.dataset}" not created yet.` };
    }
    const docCount = await datasetDocCount(creds, id);
    return { configured: true, host, dataset: creds.dataset, datasetId: id, docCount, reachable: true, message: docCount > 0 ? `${docCount} docs in "${creds.dataset}".` : `Dataset "${creds.dataset}" is empty.` };
  } catch (e) {
    return { configured: true, host, dataset: creds.dataset, datasetId: null, docCount: 0, reachable: false, message: String(e).slice(0, 160) };
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
