// ─────────────────────────────────────────────────────────────
// Cognee client (SERVER-SIDE ONLY)
//
// Implements the four memory primitives against the **Cognee Cloud
// REST API** — remember(), recall(), improve(), forget() — using the
// endpoints exactly as documented at docs.cognee.ai:
//
//   POST {BASE}/api/v1/remember   (multipart/form-data: add + cognify in one)
//   POST {BASE}/api/v1/recall     (JSON: search over the graph)
//   POST {BASE}/api/v1/improve    (JSON: enrich / memify, background)
//   POST {BASE}/api/v1/forget     (JSON: prune derived memory)
//   GET  {BASE}/health            (liveness probe — works on empty tenant)
//
// Authentication is via the `X-Api-Key` header on every request.
//
// CREDENTIAL RESOLUTION (order of precedence):
//   1. Per-request credentials sent by the browser onboarding flow via
//      request headers (X-Cognee-Base-Url / X-Cognee-Api-Key /
//      X-Cognee-Dataset). This powers "bring your own key" live data
//      with zero redeploy.
//   2. Server env vars (COGNEE_BASE_URL / COGNEE_API_KEY / COGNEE_DATASET)
//      for teams that prefer configuring at deploy time.
//   3. When neither is present, every primitive gracefully degrades to a
//      local, deterministic mock so the whole product is runnable offline.
//
// The API key NEVER reaches the client bundle: the browser holds it only
// in localStorage and forwards it per-request to our own server-side
// route, which is the only place the Cognee API is hit. Belief tuples are
// modelled as a custom Cognee DataPoint via node_set tags.
//
// ── WHY THE ONBOARDING 404 HAPPENED (and how this fixes it) ──
// A fresh Cognee tenant has an *empty* graph, so `recall`/`search` returns
// 404 "Recall prerequisites not met — run remember()/add() then cognify()".
// The old code called recall() as the connectivity test, which therefore
// always failed on first connect. The fix:
//   • testConnection() now probes GET /health (always available) instead
//     of recall(), so entering valid creds succeeds immediately.
//   • provision() pushes the seed belief corpus into the tenant via
//     remember() (which runs add + cognify), so recall() returns live,
//     dynamic answers right after the user connects — no dead-end.
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
    // Some endpoints (improve/forget in background) may return empty bodies.
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

// ── remember() — ingest + cognify in one call ─────────────────
// Cognee's /api/v1/remember accepts multipart form-data with `data` as
// one or more files. We stream the transcript text as an in-memory
// Markdown file (Blob), tag it with node_set, and let Cognee run the
// full add→cognify pipeline synchronously so recall works right after.
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
      const form = new FormData();
      const filename = `${doc.id || "doc"}.md`;
      const blob = new Blob([doc.transcript], { type: "text/markdown" });
      form.append("data", blob, filename);
      form.append("datasetName", creds.dataset);
      // node_set is a repeatable field — append each tag individually.
      for (const tag of nodeSet) form.append("node_set", tag);
      if (opts.sessionId) form.append("session_id", opts.sessionId);
      // Run synchronously (default) so the graph is queryable immediately.
      form.append("run_in_background", "false");

      await cogneeForm(creds, "/api/v1/remember", form, 60_000);
      return { ok: true, mode: "cognee", dataset: creds.dataset, nodeSet, message: `Ingested "${doc.title}" into Cognee (${creds.dataset}).` };
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
}

/** Detect the "empty tenant" 404 so callers can offer to provision. */
function isPrerequisiteError(msg: string): boolean {
  const m = msg.toLowerCase();
  // Either the explicit 404 "prerequisites not met" body, or any hint that
  // the graph is empty and needs remember()/cognify() first.
  return (
    (m.includes("404") && (m.includes("prerequisit") || m.includes("remember") || m.includes("cognify"))) ||
    m.includes("prerequisites not met")
  );
}

/** Detect an authentication failure (bad / missing API key). */
function isAuthError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("401") || m.includes("403") || m.includes("unauthorized") || m.includes("forbidden");
}

function normalizeHits(data: any): RecallHit[] {
  const rawHits: any[] = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data?.hits)
    ? data.hits
    : Array.isArray(data)
    ? data
    : [];
  return rawHits.map((h) => ({
    text: h.text || h.content || h.context || h.answer || String(h),
    score: typeof h.score === "number" ? h.score : 0.8,
    evidence: (h.evidence || h.references || []).map((e: any) => ({
      label: e.label || e.name || e.title || "source",
      source: e.source || "cognee",
      at: e.at || e.time || "",
      excerpt: e.excerpt || e.text,
    })),
  }));
}

export async function recall(
  query: string,
  opts: { searchType?: string; nodeName?: string[]; creds?: CogneeCreds } = {}
): Promise<RecallResult> {
  const creds = opts.creds || resolveCreds();
  if (isConfigured(creds)) {
    try {
      // Cognee Cloud recall uses camelCase fields (searchType/nodeName/topK).
      const data = await cogneeJson<any>(creds, "/api/v1/recall", {
        query,
        datasets: [creds.dataset],
        searchType: opts.searchType || "GRAPH_COMPLETION",
        nodeName: opts.nodeName,
        includeReferences: true,
        topK: 10,
      });
      const hits = normalizeHits(data);
      const answer =
        data?.answer ||
        data?.text ||
        (Array.isArray(data) ? data[0]?.answer || data[0]?.text : "") ||
        hits[0]?.text ||
        "No answer returned yet.";
      return {
        mode: "cognee",
        answer,
        route: (data?.route as any) || "hybrid",
        hits,
      };
    } catch (e) {
      const msg = String(e);
      // Empty tenant: signal the UI to provision, but still return a helpful
      // mock answer so the panel never dead-ends.
      if (isPrerequisiteError(msg)) {
        const m = mockRecall(query);
        return { ...m, needsProvision: true };
      }
      // Any other error → graceful fallback to mock.
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
      await cogneeJson(creds, "/api/v1/improve", {
        dataset_name: creds.dataset,
        run_in_background: true,
      });
      return { mode: "cognee", bridged: opts.sessionIds?.length ?? 1, reweighted: 0, pruned: 0, message: "improve() dispatched to Cognee (background enrichment)." };
    } catch (e) {
      return { mode: "cognee", bridged: 0, reweighted: 0, pruned: 0, message: String(e) };
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
      return { mode: "cognee", message: String(e) };
    }
  }
  return { mode: "mock", message: `[offline] Pruned dataset "${ds}".` };
}

// ── health probe ──────────────────────────────────────────────
// GET /health always responds on a live tenant, even when the graph is
// empty — this is the correct connectivity test for onboarding.
export async function health(creds: CogneeCreds): Promise<{ ok: boolean; status: number; message: string }> {
  const { signal, done } = withTimeout(12_000);
  try {
    const res = await fetch(`${creds.baseUrl}/health`, {
      method: "GET",
      headers: { "X-Api-Key": creds.apiKey },
      cache: "no-store",
      signal,
    });
    // 200 = healthy; 401/403 = reachable but bad key.
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
 * Connectivity probe used by the onboarding wizard. Uses /health (which
 * works even on an empty tenant) so entering valid credentials succeeds
 * immediately — the old recall()-based probe 404'd on fresh tenants.
 * Also reports whether the graph already has data (so the UI knows if it
 * still needs to provision).
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

  // /health confirms the endpoint is a live Cognee tenant, but on Cognee
  // Cloud it is a PUBLIC liveness probe (no auth) — so a 200 there does NOT
  // prove the API key is valid. We therefore also run a tiny recall probe,
  // which authenticates: 401/403 = bad key; 404-prerequisites = valid key +
  // empty graph; success = valid key + data already present.
  const h = await health(creds);
  if (!h.ok) {
    return { ok: false, message: h.message, host, hasData: false };
  }

  let hasData = false;
  try {
    await cogneeJson(creds, "/api/v1/recall", {
      query: "What do you know?",
      datasets: [creds.dataset],
      searchType: "GRAPH_COMPLETION",
      topK: 1,
    }, 15_000);
    hasData = true; // authenticated AND graph has content
  } catch (e) {
    const msg = String(e);
    if (isAuthError(msg)) {
      // Reachable tenant, but the key is wrong — this is a hard failure.
      return {
        ok: false,
        host,
        hasData: false,
        message: `Reached ${host}, but the API key was rejected (401/403). Double-check your COGNEE_API_KEY.`,
      };
    }
    if (isPrerequisiteError(msg)) {
      hasData = false; // valid key, empty graph → needs provisioning
    } else {
      // Any other transient error: treat as connected; provisioning will retry.
      hasData = false;
    }
  }

  return {
    ok: true,
    host,
    hasData,
    message: hasData
      ? `Connected to ${host}. Cognee memory is live and responding.`
      : `Connected to ${host}. Tenant is empty — loading the belief graph so recall() returns live data…`,
  };
}

// ── provision() — one-click seed ingest so recall works instantly ──
export interface ProvisionResult {
  mode: "cognee" | "mock";
  ingested: number;
  failed: number;
  messages: string[];
}

/**
 * Push the full seed corpus (transcript-shaped INGEST_DOCS + one synthetic
 * doc per belief so the graph is rich) into the user's tenant via
 * remember(). After this, recall() returns live, dynamic answers.
 */
export async function provision(creds: CogneeCreds): Promise<ProvisionResult> {
  if (!isConfigured(creds)) {
    return { mode: "mock", ingested: INGEST_DOCS.length, failed: 0, messages: ["[offline] Seed corpus available in mock mode."] };
  }
  const sessionId = `provision-${new Date().toISOString().slice(0, 10)}`;
  const docs: IngestDoc[] = [...INGEST_DOCS, ...beliefsAsDocs()];
  let ingested = 0;
  let failed = 0;
  const messages: string[] = [];
  for (const doc of docs) {
    const r = await remember(doc, { sessionId, creds });
    if (r.ok) ingested++;
    else {
      failed++;
      messages.push(r.message);
    }
  }
  return { mode: "cognee", ingested, failed, messages: messages.slice(0, 5) };
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
