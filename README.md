# 🧠 Meridian — The Self-Improving Stakeholder-Alignment Company Brain

> **Before GPS, there was one line everyone agreed on. Now your company has one too.**
>
> *Your teams aren't misinformed. They're misaligned.*
> **Zero degrees of separation from the truth.**

Meridian is a Cognee-powered **alignment mesh** that continuously ingests every
conversation, doc, decision and commitment across an org; builds a
**Stakeholder-Belief Graph** on top of Cognee's hybrid graph+vector memory; and
runs a self-improving `align()` lint that surfaces — and *closes* — misalignments
between people **before** they become execution failures.

Not "chat with your docs." It is a live, argumentation-grounded model of **what
each stakeholder currently believes to be true** about the company, plus a
self-improving loop that detects, ranks, and resolves the deltas.

---

## Project Overview

- **Name**: Meridian
- **Goal**: Turn organizational memory from a passive archive into a live,
  self-improving execution engine that detects and closes silent misalignment.
- **Core primitive**: the **Belief Tuple** `(holder, proposition, subject, stance,
  evidence, asserted_at, confidence)` — a custom Cognee `DataPoint`.
- **Memory layer**: Cognee Cloud (`remember` / `recall` / `improve` / `forget`),
  with a full **offline mock** over a seeded belief graph for reproducibility.

## ✅ Completed Features

- **Landing page** — cinematic hero, the insight, 4 memory primitives, the
  5-stage `align()` pipeline, 6 product surfaces, 6 Cognee-native themes, stack.
- **Ask Panel** (`/app`) — Karpathy-wiki-style GraphRAG Q&A; every answer shows
  the belief chain + evidence + confidence, not a summary.
- **Alignment Radar** (`/app/radar`) — every subject (OKR, roadmap, metric,
  decision, policy) ranked by declining Alignment Score, with trend deltas and
  contradiction cards.
- **Belief Graph Explorer** (`/app/graph`) — React Flow visualization of
  stakeholders → beliefs → subjects → evidence, filterable and click-through.
- **Lint — Alignment CI** (`/app/lint`) — 6 finding categories (4 classic + 3
  org-native: interpretation-drift, silent-commitment, stakeholder-blackout).
- **Ritual Composer** (`/app/rituals`) — proposed resolution rituals with
  pre-filled agenda, both evidence chains, and a downloadable `.ics` invite.
- **Alignment Constitution** (`/app/constitution`) — versioned, self-rewriting
  org resolution norms; amendments require human approval.
- **`align()` engine** — 5 stages: Belief Gathering → Canonicalization →
  Contradiction Detection (Dung-style attack graph) → Alignment Scoring
  (`1 − weighted_conflict/total_mass`) → Resolution Ritual.
- **`improve()` self-improvement loop** — bridge sessions, reweight
  `feedback_alpha`, propose Constitution amendment, prune stale beliefs.
- **Cognee client** — real REST API (`/api/v1/recall|remember|improve|forget`)
  with graceful offline mock fallback.
- **Meridian skill file** (`skills/meridian/SKILL.md`) — MCP-style so any agent
  can call `align()`, `lint()`, `recall()` as tools.

## 🔌 Functional Entry URIs

### Pages
| Path | Description |
|------|-------------|
| `/` | Landing (marketing / narrative) |
| `/app` | Ask Panel (GraphRAG Q&A) |
| `/app/radar` | Alignment Radar dashboard |
| `/app/graph` | Belief Graph Explorer (React Flow) |
| `/app/lint` | Alignment CI findings |
| `/app/rituals` | Ritual Composer + `.ics` export |
| `/app/constitution` | Alignment Constitution amendments |

### API (all server-side; Cognee key never reaches the client)
| Method · Path | Params | Returns |
|---------------|--------|---------|
| `POST /api/recall` | `{ query, searchType?, nodeName? }` | answer + hits + evidence |
| `GET /api/align` | – | all `AlignmentReport`s (worst first) |
| `POST /api/align` | `{ subjectId }` | single `AlignmentReport` |
| `GET /api/lint` | – | `{ findings: LintFinding[] }` |
| `POST /api/ritual` | `{ subjectId }` | proposed `Ritual` |
| `POST /api/improve` | `{ sessionIds?, feedbackAlpha? }` | loop result + proposed amendment |
| `GET /api/improve` | – (Vercel Cron) | loop result |
| `POST /api/ingest` | `{ source,title,transcript,speaker?,subject?,project? }` or `{ sample:true }` | remember() result |
| `GET /api/ingest` | – | seeded docs |
| `POST /api/feedback` | `{ targetType, targetId, vote }` | records + triggers reweight |
| `GET /api/constitution` | – | amendments |
| `GET /api/graph` | – | `{ nodes, edges }` |
| `GET /api/status` | – | mode + stats |

## 🗄️ Data Architecture

- **Data models** — `Belief`, `Stakeholder`, `Subject`, `SourceRef`,
  `Contradiction`, `Ritual`, `AlignmentReport`, `LintFinding`,
  `ConstitutionAmendment`, `IngestDoc`, `FeedbackEvent` (see `src/lib/types.ts`).
- **Storage services** — **Cognee Cloud** (hybrid graph+vector) is the single
  source of memory truth. Belief tuples are modelled as custom Cognee
  `DataPoint`s via `node_set` tagging (`source:`, `speaker:`, `subject:`,
  `project:`). No app-side database is required for the demo; an optional
  Supabase free tier can hold auth/tenant metadata/feedback in production.
- **Data flow** — Connectors → Normalizer → Belief Extractor → `cognee.remember()`
  → Cognee graph → `recall()` / `align()` / `lint()` / `improve()` → UI.
- **Offline mode** — when `COGNEE_BASE_URL` / `COGNEE_API_KEY` are unset, all
  primitives run deterministically over a seeded graph (`src/lib/seed.ts`).

## 🚀 User Guide

1. **Open the brain** → `/app`. Ask *"What is the Q3 pricing model?"* — you get an
   evidence-first answer with the belief chain.
2. **Check the Radar** → `/app/radar`. Subjects pulsing red have dropping
   alignment. Click one to see who believes what, and why.
3. **Run the lint** → `/app/lint`. See contradictions, interpretation drift,
   silent commitments and stakeholder blackouts across the whole org.
4. **Resolve** → open the Ritual Composer, schedule the 15-min sync (download the
   `.ics`), capture the outcome. Thumbs-up/down feeds `feedback_alpha`.
5. **Let it improve** → the nightly `improve()` loop folds outcomes into the
   Alignment Constitution. The org gets sharper by using itself.

## 🛠️ Local Development

```bash
npm install
npm run dev          # http://localhost:3000  (Next.js dev)
# or, production-style:
npm run build && npm start
```

Optional Cognee credentials (copy `.env.example` → `.env.local`):

```bash
COGNEE_BASE_URL="https://tenant-xxxx.aws.cognee.ai"
COGNEE_API_KEY="your-cognee-api-key"
COGNEE_DATASET="meridian-demo"
CRON_SECRET="change-me-in-production"
```

## ☁️ Deployment (Vercel free tier)

- **Platform**: **Vercel** (Hobby / free tier). No Cloudflare, no Wrangler.
- **Framework**: Next.js 15 (App Router, RSC) — zero-config on Vercel.
- **Cron**: `vercel.json` schedules the nightly `improve()` at 06:00 UTC.
- **Secrets**: set `COGNEE_BASE_URL`, `COGNEE_API_KEY`, `COGNEE_DATASET`,
  `CRON_SECRET` in Vercel → Project → Settings → Environment Variables.
- **Status**: ✅ Build passes; all 20 routes render. Runs fully offline if
  Cognee credentials are omitted.

Steps:
1. Push this repo to GitHub.
2. Import into Vercel → it auto-detects Next.js.
3. Add the env vars above (optional for demo).
4. Deploy. Done.

## 🧩 Tech Stack (100% free & open-source)

| Layer | Tool |
|-------|------|
| Framework | Next.js 15 (App Router, RSC) |
| Styling | Tailwind CSS |
| Graph viz | React Flow |
| Memory | Cognee Cloud + offline mock |
| Cron | Vercel Cron |
| Hosting | Vercel (free tier) |
| Language | TypeScript |
| License | Apache-2.0 |

## 📁 Structure

```
src/
  app/
    page.tsx                 # landing
    layout.tsx, globals.css, icon.svg
    app/                     # authenticated product surfaces
      page.tsx               # Ask Panel
      radar/ graph/ lint/ rituals/ constitution/
    api/                     # server-side routes (Cognee proxy + engines)
      recall align lint ritual improve ingest feedback constitution graph status
  components/                # AppShell, AlignmentCard, GraphExplorer, icons, ...
  lib/
    types.ts                 # domain types (Belief Tuple, etc.)
    cognee.ts                # Cognee REST client + offline mock
    align.ts                 # 5-stage align() engine
    lint.ts                  # lint() — alignment CI
    seed.ts                  # seeded stakeholders / subjects / beliefs / docs
skills/meridian/SKILL.md     # MCP-style skill file for agents
vercel.json                  # Vercel cron config
```

## 🔭 Not Yet Implemented / Next Steps

- Live connectors (Slack Events API, Granola export, GitHub/Linear webhooks) —
  ingestion contract is defined; wire real webhooks in production.
- Supabase auth + multi-tenant metadata for a hosted SaaS tier.
- Per-employee `me:` private namespace (Personal Memory tier).
- Auto-generated read-only "Company Wiki" view from stable beliefs.
- Real NLI model for stage-3 stance detection (currently stance-based heuristic).

## 📚 Research Grounding

Cognee (arXiv 2505.24478), Hybrid GraphRAG (2507.03608), temporal KG / Graphiti
(2501.13956), Mem0 (2504.19413), Reflexion (2303.11366), Constitutional AI
(2212.08073), argumentation frameworks (KR 2025), policy KG contradiction
detection (2604.27713) — each mapped to a component.

---

**License**: Apache-2.0 · Built on [Cognee](https://www.cognee.ai/).
*"The org just got sharper by using itself."*
