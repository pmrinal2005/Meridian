import { NextRequest, NextResponse } from "next/server";
import { provision, cogneeMode, resolveCreds, isConfigured } from "@/lib/cognee";

export const runtime = "nodejs";
// Ingesting the seed corpus can take a while (Cognee runs add + cognify per
// doc). Vercel Hobby caps serverless at 60s; request the max the platform
// grants. The client can call this repeatedly (with ?limit=) until docs land.
export const maxDuration = 60;

// One-click provisioning: push the seed belief corpus into the user's Cognee
// tenant so recall() returns live, dynamic answers immediately after connect.
// This is what closes the onboarding gap — a fresh tenant is empty until
// remember()/cognify() has run at least once. We now ingest DURABLY (no
// session_id) so the data lands in the permanent dataset and is visible as
// docs in the Brain, then report the REAL dataset doc count.
export async function POST(req: NextRequest) {
  const creds = resolveCreds(req.headers);
  if (!isConfigured(creds)) {
    return NextResponse.json(
      { error: "Cognee credentials required to provision. Enter your base URL and API key first." },
      { status: 400 }
    );
  }
  // Optional bounded batch so a single serverless call fits the time budget.
  const { searchParams } = new URL(req.url);
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Math.max(1, parseInt(limitRaw, 10) || 0) : undefined;

  const result = await provision(creds, { limit });
  const ok = result.ingested > 0 || (result.datasetDocs ?? 0) > 0;
  return NextResponse.json(
    { ...result, ok, cognee: cogneeMode(req.headers) },
    { status: ok ? 200 : 502 }
  );
}
