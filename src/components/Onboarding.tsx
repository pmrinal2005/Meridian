"use client";

import { useEffect, useState } from "react";
import { IconBrain, IconArrow, IconCheck, IconAlert, IconClose, IconSpark } from "./icons";
import {
  loadCreds,
  saveCreds,
  clearCreds,
  hasOnboarded,
  markOnboarded,
  apiFetch,
  type CogneeCreds,
} from "@/lib/credsClient";

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/**
 * 4-step "Connect API / MCP" onboarding wizard.
 * Step 1 — set API credentials (base URL + key + dataset)
 * Step 2 — how to query the REST API (curl example, auto-filled)
 * Step 3 — install the Cognee/Meridian skill (MCP)
 * Step 4 — test the connection ("What do you know from cognee?")
 *
 * Shown automatically on first visit to the app; re-openable any time
 * from the sidebar. Credentials are stored in this browser only.
 */
export default function Onboarding({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [dataset, setDataset] = useState("meridian-demo");
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });

  // Prefill from any previously saved creds.
  useEffect(() => {
    if (!open) return;
    const c = loadCreds();
    if (c) {
      setBaseUrl(c.baseUrl);
      setApiKey(c.apiKey);
      setDataset(c.dataset);
    }
    setStep(1);
    setTest({ status: "idle" });
  }, [open]);

  if (!open) return null;

  const creds: CogneeCreds = {
    baseUrl: baseUrl.trim().replace(/\/$/, ""),
    apiKey: apiKey.trim(),
    dataset: dataset.trim() || "meridian-demo",
  };
  const canProceed = Boolean(creds.baseUrl && creds.apiKey);

  const curl = `curl -X POST ${creds.baseUrl || "https://tenant-xxxx.aws.cognee.ai"}/api/v1/recall \\
  -H "X-Api-Key: ${creds.apiKey ? creds.apiKey.slice(0, 6) + "…" : "your-api-key"}" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "What are the main entities?"}'`;

  async function runTest() {
    setTest({ status: "testing" });
    // Persist first so apiFetch forwards the headers.
    saveCreds(creds);
    try {
      const r = await apiFetch("/api/test-connection", { method: "POST" });
      const d = await r.json();
      if (r.ok && d.ok) setTest({ status: "ok", message: d.message });
      else setTest({ status: "error", message: d.message || "Connection failed." });
    } catch (e) {
      setTest({ status: "error", message: String(e) });
    }
  }

  function finishLive() {
    saveCreds(creds);
    onClose();
  }

  function skipOffline() {
    // User chose to explore with seeded demo data.
    clearCreds();
    markOnboarded();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-floatUp">
        {/* header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-ink-950 to-primary-700 text-white">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-white/15">
            <IconBrain width={20} height={20} />
          </span>
          <div className="flex-1">
            <div className="font-bold tracking-tight">Connect Cognee memory</div>
            <div className="text-[11px] uppercase tracking-widest text-white/70">Step {step} of 4</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-white/70 hover:text-white cursor-pointer"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        {/* progress */}
        <div className="flex gap-1.5 px-6 pt-4">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-slate-200"}`}
            />
          ))}
        </div>

        <div className="px-6 py-5 min-h-[300px]">
          {/* STEP 1 — credentials */}
          {step === 1 && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (canProceed) setStep(2);
              }}
            >
              <div>
                <h3 className="font-semibold text-ink-900">1 · Set your API credentials</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Paste your Cognee endpoint and key. They are stored <b>only in this browser</b> and
                  forwarded to Meridian&apos;s own server routes — never to any third party, never in the bundle.
                  Leave blank to explore with seeded demo data.
                </p>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">COGNEE_BASE_URL</span>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://tenant-xxxx.aws.cognee.ai"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">COGNEE_API_KEY</span>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="df8c58d…2a5fd"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    onClick={() => setShowKey((v) => !v)}
                    className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    {showKey ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">COGNEE_DATASET (optional)</span>
                <input
                  value={dataset}
                  onChange={(e) => setDataset(e.target.value)}
                  placeholder="meridian-demo"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>
          )}

          {/* STEP 2 — query the REST API */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-ink-900">2 · Query the REST API</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Send a recall query to your Cognee endpoint from any HTTP client. This is exactly
                  what Meridian&apos;s server routes do on your behalf.
                </p>
              </div>
              <pre className="rounded-xl bg-ink-950 text-slate-100 text-xs p-4 overflow-x-auto whitespace-pre-wrap font-mono">
                {curl}
              </pre>
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
                Meridian routes all four primitives for you — <code>remember()</code>,{" "}
                <code>recall()</code>, <code>improve()</code>, <code>forget()</code> — keeping your
                key server-side.
              </div>
            </div>
          )}

          {/* STEP 3 — install the skill */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-ink-900">3 · Or install the Meridian / Cognee skill</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Prefer skills / MCP? Point your agent at the bundled skill file so it can call{" "}
                  <code>align()</code>, <code>lint()</code> and <code>recall()</code> as tools using
                  the credentials from step 1.
                </p>
              </div>
              <pre className="rounded-xl bg-slate-100 text-slate-700 text-xs p-4 overflow-x-auto font-mono">
                skills/meridian/SKILL.md
              </pre>
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
                The skill teaches any Claude Code / Cursor / LangGraph agent to hit the Cognee API with
                your endpoint + key. Add it to your agent&apos;s skills directory, instructions file,
                or system prompt.
              </div>
            </div>
          )}

          {/* STEP 4 — test connection */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-ink-900">4 · Test the connection</h3>
                <p className="text-sm text-slate-500 mt-1">
                  We&apos;ll ask your brain <i>&quot;What do you know from cognee?&quot;</i> — its memory should
                  respond. On success, every dashboard switches from demo data to your live tenant.
                </p>
              </div>

              {!canProceed && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                  No credentials entered. You can still continue — Meridian will run on seeded demo data
                  (offline mock) so you can explore every feature.
                </div>
              )}

              {canProceed && (
                <button
                  onClick={runTest}
                  disabled={test.status === "testing"}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:shadow-glow transition-all cursor-pointer disabled:opacity-50"
                >
                  <IconSpark width={16} height={16} />
                  {test.status === "testing" ? "Testing…" : "Test connection"}
                </button>
              )}

              {test.status === "ok" && (
                <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                  <IconCheck width={18} height={18} className="mt-0.5 shrink-0" />
                  <span>{test.message}</span>
                </div>
              )}
              {test.status === "error" && (
                <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
                  <IconAlert width={18} height={18} className="mt-0.5 shrink-0" />
                  <span>{test.message}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={skipOffline}
            className="text-sm text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Skip · use demo data
          </button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-white cursor-pointer"
              >
                Back
              </button>
            )}
            {step < 4 && (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-950 cursor-pointer"
              >
                Next <IconArrow width={15} height={15} />
              </button>
            )}
            {step === 4 && (
              <button
                onClick={finishLive}
                disabled={!canProceed}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-glow cursor-pointer disabled:opacity-40"
              >
                <IconCheck width={15} height={15} /> Go live
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
