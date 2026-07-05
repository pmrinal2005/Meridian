"use client";

import { useEffect, useState } from "react";
import { IconBrain, IconCheck, IconAlert, IconClose, IconSpark } from "./icons";
import {
  loadCreds,
  saveCreds,
  clearCreds,
  apiFetch,
  type CogneeCreds,
} from "@/lib/credsClient";

type Phase =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "provisioning"; ingested?: number }
  | { status: "live"; message: string }
  | { status: "error"; message: string };

/**
 * Streamlined "Connect Cognee" onboarding.
 *
 * The user only has ONE job: paste their Base URL + API key. Meridian then
 * automatically (a) verifies the tenant via /health, (b) provisions the seed
 * belief graph so recall() has data, and (c) flips every dashboard to live,
 * dynamic Cognee data — no extra manual steps.
 *
 * Why not the old 4-step wizard? Steps 2–4 (curl example, skill install,
 * manual "test") were passive documentation that dead-ended on a 404 because
 * a fresh tenant is empty. Now connecting is a single active flow that leaves
 * the tenant queryable. The curl/skill reference still lives in a collapsible
 * "Advanced" drawer for power users.
 */
export default function Onboarding({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [dataset, setDataset] = useState("meridian-demo");
  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [phase, setPhase] = useState<Phase>({ status: "idle" });

  useEffect(() => {
    if (!open) return;
    const c = loadCreds();
    if (c) {
      setBaseUrl(c.baseUrl);
      setApiKey(c.apiKey);
      setDataset(c.dataset);
    }
    setPhase({ status: "idle" });
  }, [open]);

  if (!open) return null;

  const creds: CogneeCreds = {
    baseUrl: baseUrl.trim().replace(/\/$/, ""),
    apiKey: apiKey.trim(),
    dataset: dataset.trim() || "meridian-demo",
  };
  const canProceed = Boolean(creds.baseUrl && creds.apiKey);
  const busy = phase.status === "testing" || phase.status === "provisioning";

  const curl = `curl -X POST ${creds.baseUrl || "https://tenant-xxxx.aws.cognee.ai"}/api/v1/recall \\
  -H "X-Api-Key: ${creds.apiKey ? creds.apiKey.slice(0, 6) + "…" : "your-api-key"}" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "What are the main entities?", "searchType": "GRAPH_COMPLETION"}'`;

  // The one-click flow: save creds → /health test → provision seed → go live.
  async function connectAndGoLive() {
    if (!canProceed) return;
    // Persist first so apiFetch forwards the credential headers.
    saveCreds(creds);

    // 1) verify connectivity via /health (works on an empty tenant).
    setPhase({ status: "testing" });
    try {
      const tRes = await apiFetch("/api/test-connection", { method: "POST" });
      const t = await tRes.json();
      if (!tRes.ok || !t.ok) {
        setPhase({ status: "error", message: t.message || "Connection failed." });
        return;
      }

      // 2) if the tenant already has memory, we're immediately live.
      if (t.hasData) {
        setPhase({ status: "live", message: `Connected to ${t.host}. Live memory detected — dashboards are now dynamic.` });
        return;
      }

      // 3) empty tenant → provision the seed belief graph so recall works.
      setPhase({ status: "provisioning" });
      const pRes = await apiFetch("/api/provision", { method: "POST" });
      const p = await pRes.json();
      if (!pRes.ok || !p.ok) {
        setPhase({
          status: "error",
          message:
            (p.messages && p.messages[0]) ||
            p.error ||
            "Provisioning failed. Check that your key has write access, then retry.",
        });
        return;
      }
      setPhase({
        status: "live",
        message: `Ingested ${p.ingested} sources into ${creds.dataset}. Your brain is live — ask it anything.`,
      });
    } catch (e) {
      setPhase({ status: "error", message: String(e) });
    }
  }

  function finishLive() {
    saveCreds(creds);
    onClose();
  }

  function skipOffline() {
    clearCreds();
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
            <div className="text-[11px] uppercase tracking-widest text-white/70">
              Paste your keys · we handle the rest
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-white/70 hover:text-white cursor-pointer"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <h3 className="font-semibold text-ink-900">Set your API credentials</h3>
            <p className="text-sm text-slate-500 mt-1">
              Paste your Cognee endpoint and key. They are stored <b>only in this browser</b> and
              forwarded to Meridian&apos;s own server routes — never to any third party, never in the
              bundle. When you click <b>Connect &amp; go live</b>, Meridian verifies the tenant and
              auto-loads the belief graph so every dashboard turns dynamic.
            </p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              connectAndGoLive();
            }}
          >
            <label className="block">
              <span className="text-xs font-medium text-slate-600">COGNEE_BASE_URL</span>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://tenant-xxxx.aws.cognee.ai"
                autoComplete="url"
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
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
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

            <button
              type="submit"
              disabled={!canProceed || busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:shadow-glow transition-all cursor-pointer disabled:opacity-50"
            >
              <IconSpark width={16} height={16} />
              {phase.status === "testing"
                ? "Verifying tenant…"
                : phase.status === "provisioning"
                ? "Loading belief graph…"
                : "Connect & go live"}
            </button>
          </form>

          {/* status feedback */}
          {phase.status === "provisioning" && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              <span className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />
              <span>
                Tenant is empty — ingesting the seed belief graph via <code>remember()</code>{" "}
                (add + cognify). This runs once and makes <code>recall()</code> return live data.
              </span>
            </div>
          )}
          {phase.status === "live" && (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
              <IconCheck width={18} height={18} className="mt-0.5 shrink-0" />
              <span>{phase.message}</span>
            </div>
          )}
          {phase.status === "error" && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
              <IconAlert width={18} height={18} className="mt-0.5 shrink-0" />
              <span>{phase.message}</span>
            </div>
          )}

          {/* Advanced drawer: curl + skill reference for power users */}
          <div className="rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-ink-900 cursor-pointer"
            >
              <span>Advanced · REST &amp; MCP skill (optional)</span>
              <span className="text-xs text-slate-400">{showAdvanced ? "Hide" : "Show"}</span>
            </button>
            {showAdvanced && (
              <div className="space-y-3 border-t border-slate-100 px-4 py-3">
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">Query the REST API directly</div>
                  <pre className="rounded-lg bg-ink-950 text-slate-100 text-[11px] p-3 overflow-x-auto whitespace-pre-wrap font-mono">
                    {curl}
                  </pre>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">Or install the Meridian / Cognee skill (MCP)</div>
                  <pre className="rounded-lg bg-slate-100 text-slate-700 text-[11px] p-3 overflow-x-auto font-mono">
                    skills/meridian/SKILL.md
                  </pre>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Point any Claude Code / Cursor / LangGraph agent at this file to call{" "}
                    <code>align()</code>, <code>lint()</code>, <code>recall()</code> as tools using
                    the credentials above.
                  </p>
                </div>
              </div>
            )}
          </div>
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
            {phase.status === "live" ? (
              <button
                onClick={finishLive}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-glow cursor-pointer"
              >
                <IconCheck width={15} height={15} /> Enter dashboard
              </button>
            ) : (
              <button
                onClick={finishLive}
                disabled={!canProceed}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-white cursor-pointer disabled:opacity-40"
                title="Save credentials and close without provisioning"
              >
                Save &amp; close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
