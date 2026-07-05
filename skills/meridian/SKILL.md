---
name: meridian
description: >
  Meridian — the self-improving Stakeholder-Alignment Company Brain on Cognee.
  Use this skill to query organizational memory, run the align() lint over the
  company itself, detect silent misalignment between stakeholders, propose
  resolution rituals, and trigger the nightly improve() self-improvement loop.
  Every answer is grounded in a Stakeholder-Belief Graph and returns evidence,
  confidence, and an Alignment Score. Backed by Cognee hybrid graph+vector memory.
version: 1.0.0
license: Apache-2.0
---

# Meridian Skill

Meridian turns organizational memory into a live **alignment engine**. It models
what every stakeholder *currently believes to be true* about the company as a
**Belief Tuple** `(holder, proposition, subject, stance, evidence, asserted_at,
confidence)` — a custom Cognee `DataPoint` — then runs a self-improving `align()`
lint that surfaces and closes misalignments before they become execution failures.

Point any agent (Claude Code, Cursor, LangGraph, etc.) at this file, or expose
the HTTP endpoints below as tools.

## Credentials

Meridian keeps Cognee credentials **server-side only**. Set them in the
environment (never `NEXT_PUBLIC_*`). If absent, Meridian runs in a fully
featured **offline mock** over a seeded belief graph so the whole product is
reproducible without credits.

```bash
export COGNEE_BASE_URL="https://tenant-xxxx.aws.cognee.ai"
export COGNEE_API_KEY="your-cognee-api-key"
export COGNEE_DATASET="meridian-demo"
```

The Cognee client (`src/lib/cognee.ts`) implements the four memory primitives
against the Cognee Cloud REST API exactly as documented:

```bash
curl -X POST "$COGNEE_BASE_URL/api/v1/recall" \
  -H "X-Api-Key: $COGNEE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the main entities?"}'
```

## Memory primitives (Cognee-native)

| Primitive    | What it does in Meridian |
|--------------|--------------------------|
| `remember()` | Ingest a transcript-shaped doc → extract Belief tuples → tag `node_set: [source:X, speaker:Y, subject:Z, project:P]`. |
| `recall()`   | GraphRAG Q&A; Cognee auto-routes between semantic similarity and deep graph traversal. Returns answer + evidence chain + confidence. |
| `improve()`  | Nightly: bridge session → permanent graph, reweight `feedback_alpha`, propose a Constitution amendment, prune stale beliefs. |
| `forget()`   | Surgically prune datasets / superseded beliefs. |

## Tools (HTTP endpoints)

Base URL: your deployment (e.g. `https://your-app.vercel.app`) or `http://localhost:3000`.

### `recall` — ask the company brain
```
POST /api/recall
{ "query": "What is the Q3 pricing model?", "searchType": "GRAPH_COMPLETION" }
→ { mode, route, answer, hits:[{ text, score, evidence:[{label,source,at,excerpt}] }] }
```

### `align` — the 5-stage alignment engine
```
GET  /api/align                 → { reports: AlignmentReport[] }   (all subjects, worst first)
POST /api/align { subjectId }   → single AlignmentReport
```
`AlignmentReport = { subject, score (0..1), beliefs, contradictions, ritual, trend }`.
Stages: (1) Belief Gathering (2) Canonicalization (3) Contradiction Detection
(Dung-style attack graph) (4) Alignment Scoring `1 − weighted_conflict/total_mass`
(5) Resolution Ritual proposal.

### `lint` — company-wide alignment CI
```
GET /api/lint → { findings: LintFinding[] }
```
Categories: `contradiction`, `superseded-referenced`, `ownership-orphan`, and the
org-native ⭐ `interpretation-drift`, ⭐ `silent-commitment`, ⭐ `stakeholder-blackout`.

### `ritual` — propose a resolution ritual
```
POST /api/ritual { subjectId } → { ritual: { title, participants, agenda, evidenceChains, ... } }
```
The UI exports the ritual as a downloadable `.ics` (no paid calendar API needed).

### `improve` — self-improvement loop
```
POST /api/improve { sessionIds?, feedbackAlpha? }
→ { result, proposedAmendment, steps:[Bridge, Reweight, Constitution, Prune] }
```
Protected by `CRON_SECRET` when set (`Authorization: Bearer <secret>`). Also runs
on Vercel Cron (`GET /api/improve`, scheduled in `vercel.json`).

### `ingest` — remember() a transcript
```
POST /api/ingest { source, title, transcript, speaker?, subject?, project? }
POST /api/ingest { "sample": true }   # replay seeded Slack + Granola docs
GET  /api/ingest                      # list seeded docs
```

### `feedback` — thumbs up/down (drives feedback_alpha)
```
POST /api/feedback { targetType:"alignment"|"ritual"|"constitution", targetId, vote:1|-1 }
```

### `constitution` — the self-rewriting alignment norms
```
GET /api/constitution → { amendments: ConstitutionAmendment[] }
```

### `graph` — belief graph for visualization
```
GET /api/graph → { nodes, edges }   # stakeholders, subjects, beliefs, evidence
```

### `status` — mode + stats
```
GET /api/status → { cognee:{ configured, dataset, baseUrlHost }, stats:{...} }
```

## Example agent flow

1. `recall("Where does the org stand on Q3 pricing?")` → evidence-first answer.
2. `align({subjectId:"sub-pricing"})` → score 62% ⚠, contradiction between Sales and Product.
3. `ritual({subjectId:"sub-pricing"})` → 15-min sync with pre-filled agenda + both evidence chains.
4. Human resolves → `feedback({targetType:"ritual", targetId, vote:1})`.
5. Nightly `improve()` folds the outcome into the Alignment Constitution.

> The org just got sharper by using itself. That is the loop.
