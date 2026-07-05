import { NextRequest, NextResponse } from "next/server";
import { improve, cogneeMode } from "@/lib/cognee";
import { CONSTITUTION } from "@/lib/seed";

export const runtime = "nodejs";

// Nightly improve() loop (also invokable manually / via Vercel Cron).
// 1. Bridge session memory  2. Reweight feedback_alpha
// 3. Propose Constitution amendment  4. Prune stale beliefs
export async function POST(req: NextRequest) {
  // Optional cron protection
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const sessionIds = body?.sessionIds || [`session-${new Date().toISOString().slice(0, 10)}`];

  const result = await improve({ sessionIds, feedbackAlpha: body?.feedbackAlpha });

  // Surface the pending Constitution amendment proposed by the loop.
  const proposedAmendment = CONSTITUTION.find((c) => c.status === "proposed") || null;

  return NextResponse.json({
    result,
    proposedAmendment,
    steps: [
      { name: "Bridge", detail: `Bridged ${result.bridged} session(s) into permanent graph.` },
      { name: "Reweight", detail: `Adapted feedback_alpha on ${result.reweighted} belief edges.` },
      { name: "Constitution", detail: proposedAmendment ? `Proposed amendment v${proposedAmendment.version} (needs approval).` : "No new amendment." },
      { name: "Prune", detail: `Pruned ${result.pruned} stale belief(s) via forget().` },
    ],
    cognee: cogneeMode(),
  });
}

// Vercel Cron hits GET on a schedule.
export async function GET() {
  const result = await improve({ sessionIds: [`session-${new Date().toISOString().slice(0, 10)}`] });
  return NextResponse.json({ result, cron: true, cognee: cogneeMode() });
}
