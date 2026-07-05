import Link from "next/link";
import { IconBrain, IconArrow, IconRadar, IconGraph, IconLint, IconScroll, IconSpark, IconRitual, IconCheck } from "@/components/icons";

const THEMES = [
  { t: "Personal Memory Agent", d: "Every employee gets a private me: namespace — never asks the same question twice." },
  { t: "Research & Knowledge Copilot", d: "The Stakeholder-Belief Graph is a living wiki, auto-generated from stable beliefs." },
  { t: "Never-Forget Workflows", d: "Standups, launch checklists and OKR reviews run against permanent memory." },
  { t: "Self-Improving Agents", d: "Nightly improve() reweights, bridges, and rewrites the Alignment Constitution." },
  { t: "Support & Customer Memory", d: "Each customer is a stakeholder — track what they told sales vs. support." },
  { t: "Company Brain", d: "Native Slack + Granola ingest with Person / Decision / Belief DataPoints." },
];

const PRIMS = [
  { fn: "remember()", d: "Ingest text, files and URLs; structure them into the belief graph." },
  { fn: "recall()", d: "Cognee auto-routes between semantic similarity and deep graph traversal." },
  { fn: "improve()", d: "Post-ingestion enrichment, prune stale nodes, adapt weights from feedback." },
  { fn: "forget()", d: "Surgically prune datasets when they no longer matter." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-ink-950 text-slate-200 overflow-x-hidden">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-30 backdrop-blur-md bg-ink-950/70 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-500 text-white">
              <IconBrain width={20} height={20} />
            </span>
            <span className="font-extrabold text-white text-lg tracking-tight">Meridian</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#themes" className="hover:text-white transition-colors">Themes</a>
            <a href="#stack" className="hover:text-white transition-colors">Stack</a>
          </nav>
          <Link href="/app" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-glow transition-shadow cursor-pointer">
            Open the Brain <IconArrow width={16} height={16} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-40 pb-28 px-6">
        <div className="absolute inset-0 grain opacity-60" />
        {/* the meridian line */}
        <div className="absolute top-1/2 inset-x-0 h-px meridian-line bg-meridian/20" aria-hidden />
        <div className="relative max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-meridian/30 bg-meridian/10 px-4 py-1.5 text-xs font-medium text-meridian mb-8">
            <IconSpark width={14} height={14} /> Powered by Cognee hybrid graph-vector memory
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.05]">
            Before GPS, there was<br />
            <span className="bg-gradient-to-r from-meridian via-amber-300 to-meridian bg-clip-text text-transparent">one line everyone agreed on.</span>
          </h1>
          <p className="mt-7 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Your teams aren&apos;t misinformed. They&apos;re <span className="text-white font-medium">misaligned</span>.
            Meridian builds a live model of what every stakeholder believes to be true — and closes the deltas before they become launch slips.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/app/radar" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-600 px-6 py-3 font-semibold text-white hover:shadow-glow transition-all cursor-pointer">
              See the Alignment Radar <IconArrow width={18} height={18} />
            </Link>
            <Link href="/app" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-6 py-3 font-semibold text-slate-200 hover:bg-white/5 transition-colors cursor-pointer">
              Ask the company brain
            </Link>
          </div>
          <p className="mt-6 text-xs uppercase tracking-widest text-slate-500">Zero degrees of separation from the truth</p>
        </div>
      </section>

      {/* The insight */}
      <section className="relative border-y border-white/10 bg-white/[0.02] py-20 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8 items-start">
          <div className="md:col-span-1">
            <h2 className="text-2xl font-bold text-white">The insight nobody shipped</h2>
          </div>
          <p className="md:col-span-2 text-lg text-slate-300 leading-relaxed">
            Organizations don&apos;t fail from missing information. They fail from <span className="text-meridian font-semibold">silent misalignment</span> — two teams executing on contradictory interpretations of the same &ldquo;shared&rdquo; decision, and nobody notices until a launch slips.
            <span className="block mt-4 text-slate-400 text-base">
              40–60% of strategy-execution failures trace to unsurfaced interpretation drift. Meridian runs a <code className="text-white bg-white/10 px-1.5 py-0.5 rounded">lint()</code> over the org itself.
            </span>
          </p>
        </div>
      </section>

      {/* Primitives */}
      <section id="how" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Four memory primitives. One alignment engine.</h2>
            <p className="mt-3 text-slate-400">Meridian uses Cognee as the memory layer — not a wrapper around it.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PRIMS.map((p) => (
              <div key={p.fn} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-primary/40 transition-colors">
                <code className="text-meridian font-mono text-lg font-semibold">{p.fn}</code>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">{p.d}</p>
              </div>
            ))}
          </div>

          {/* pipeline */}
          <div className="mt-16 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-8">
            <h3 className="text-sm uppercase tracking-widest text-meridian mb-6">The align() pipeline · 5 stages</h3>
            <div className="grid md:grid-cols-5 gap-3">
              {["Belief Gathering", "Canonicalization", "Contradiction Detection", "Alignment Scoring", "Resolution Ritual"].map((s, i) => (
                <div key={s} className="relative rounded-xl bg-ink-900 border border-white/10 p-4">
                  <div className="text-2xl font-extrabold text-white/20">{i + 1}</div>
                  <div className="text-sm font-medium text-slate-200 mt-1">{s}</div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm text-slate-500">No competitor does stages 3–5. Meridian <em>proposes</em>, humans <em>decide</em>, and the outcome becomes training data.</p>
          </div>
        </div>
      </section>

      {/* Surfaces */}
      <section className="py-24 px-6 bg-white/[0.02] border-y border-white/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-14">Six surfaces, one brain</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: IconRadar, t: "Alignment Radar", d: "Rings of subjects ordered by declining alignment score. Red pulses when a new contradiction lands." },
              { icon: IconGraph, t: "Belief Graph Explorer", d: "Every belief chain, evidence-first, filterable by stakeholder and subject." },
              { icon: IconLint, t: "Lint — Alignment CI", d: "Contradictions, interpretation drift, silent commitments, stakeholder blackouts." },
              { icon: IconRitual, t: "Ritual Composer", d: "Pre-filled agenda + both evidence chains + a downloadable .ics invite." },
              { icon: IconScroll, t: "Alignment Constitution", d: "A versioned, self-rewriting document of how the org resolves conflict." },
              { icon: IconBrain, t: "Ask Panel", d: "Karpathy-wiki-style GraphRAG answers that show the belief chain, not a summary." },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.t} className="rounded-2xl border border-white/10 bg-ink-900/60 p-6 hover:-translate-y-1 transition-transform">
                  <Icon width={26} height={26} className="text-primary-400" />
                  <h3 className="mt-4 font-semibold text-white">{s.t}</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">{s.d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Themes */}
      <section id="themes" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">One primitive. Six Cognee-native themes.</h2>
          <p className="text-center text-slate-400 mb-14">The Stakeholder-Belief Graph generalizes to any group of humans that must stay aligned.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {THEMES.map((th) => (
              <div key={th.t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center gap-2 text-meridian mb-2"><IconCheck width={16} height={16} /><span className="text-xs uppercase tracking-widest">Satisfied</span></div>
                <h3 className="font-semibold text-white">{th.t}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{th.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stack */}
      <section id="stack" className="py-24 px-6 bg-white/[0.02] border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">100% free & open-source. Vercel-deployable.</h2>
          <p className="text-slate-400 mb-8">Next.js 15 · Cognee Cloud · React Flow · Tailwind · Apache-2.0. The API key stays server-side; graceful offline mock for reproducibility.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {["Next.js 15", "Cognee", "React Flow", "Tailwind CSS", "Vercel", "TypeScript", "Apache-2.0"].map((t) => (
              <span key={t} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300">{t}</span>
            ))}
          </div>
          <div className="mt-12">
            <Link href="/app" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-600 px-8 py-4 text-lg font-semibold text-white hover:shadow-glow transition-all cursor-pointer">
              Open the Company Brain <IconArrow width={20} height={20} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10 px-6 text-center text-sm text-slate-500">
        <p>Meridian — built on Cognee. &ldquo;The org just got sharper by using itself.&rdquo;</p>
      </footer>
    </div>
  );
}
