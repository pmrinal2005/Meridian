"use client";

// ─────────────────────────────────────────────────────────────
// Browser-side Cognee credential store + fetch wrapper.
//
// The onboarding wizard captures the user's Cognee endpoint + API key
// and persists them in localStorage (this browser only). Every call to
// our own server routes then forwards them as request headers via
// `apiFetch`, so the backend can hit the user's live tenant with zero
// redeploy. If the user skips onboarding, no headers are sent and the
// server transparently falls back to the seeded offline mock.
//
// SECURITY: the key lives only in this browser's localStorage and is
// sent exclusively to Meridian's own same-origin API routes — never to
// any third party from the client, and never embedded in the bundle.
// ─────────────────────────────────────────────────────────────

export interface CogneeCreds {
  baseUrl: string;
  apiKey: string;
  dataset: string;
}

const KEY = "meridian.cognee.creds.v1";
const ONBOARDED = "meridian.onboarded.v1";

export function loadCreds(): CogneeCreds | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as CogneeCreds;
    if (!c.baseUrl || !c.apiKey) return null;
    return { baseUrl: c.baseUrl, apiKey: c.apiKey, dataset: c.dataset || "meridian-demo" };
  } catch {
    return null;
  }
}

export function saveCreds(c: CogneeCreds) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    KEY,
    JSON.stringify({
      baseUrl: c.baseUrl.trim().replace(/\/$/, ""),
      apiKey: c.apiKey.trim(),
      dataset: (c.dataset || "meridian-demo").trim(),
    })
  );
  window.localStorage.setItem(ONBOARDED, "1");
  // Let listeners (AppShell status badge, etc.) react immediately.
  window.dispatchEvent(new Event("meridian:creds"));
}

export function clearCreds() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  // keep ONBOARDED so we don't re-nag; they explicitly chose offline
  window.localStorage.setItem(ONBOARDED, "1");
  window.dispatchEvent(new Event("meridian:creds"));
}

export function hasOnboarded(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ONBOARDED) === "1";
}

export function markOnboarded() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDED, "1");
  window.dispatchEvent(new Event("meridian:creds"));
}

/** Build the credential headers for a request (empty object if offline). */
export function credHeaders(): Record<string, string> {
  const c = loadCreds();
  if (!c) return {};
  return {
    "x-cognee-base-url": c.baseUrl,
    "x-cognee-api-key": c.apiKey,
    "x-cognee-dataset": c.dataset,
  };
}

/**
 * Drop-in replacement for fetch() against our own /api/* routes that
 * automatically attaches the user's Cognee credentials as headers.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  for (const [k, v] of Object.entries(credHeaders())) headers.set(k, v);
  return fetch(input, { ...init, headers });
}
