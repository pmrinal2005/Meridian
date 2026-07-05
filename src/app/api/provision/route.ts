import { NextRequest, NextResponse } from "next/server";
import { provision, cogneeMode, resolveCreds, isConfigured } from "@/lib/cognee";

export const runtime = "nodejs";
// Ingesting the seed corpus can take a while (Cognee runs add + cognify per
// doc). Allow the longest window the platform grants.
export const maxDuration = 60;

// One-click provisioning: push the seed belief corpus into the user's Cognee
// tenant so recall() returns live, dynamic answers immediately after connect.
// This is what closes the onboarding 404 gap — a fresh tenant is empty until
// remember()/cognify() has run at least once.
export async function POST(req: NextRequest) {
  const creds = resolveCreds(req.headers);
  if (!isConfigured(creds)) {
    return NextResponse.json(
      { error: "Cognee credentials required to provision. Enter your base URL and API key first." },
      { status: 400 }
    );
  }
  const result = await provision(creds);
  const ok = result.ingested > 0;
  return NextResponse.json(
    { ...result, ok, cognee: cogneeMode(req.headers) },
    { status: ok ? 200 : 502 }
  );
}
