import { NextRequest, NextResponse } from "next/server";
import { resolveCreds, testConnection } from "@/lib/cognee";

export const runtime = "nodejs";

// Onboarding wizard "Test connection" step. The browser forwards the
// user-entered credentials via headers; we probe the tenant server-side
// so the API key never leaves our own backend.
export async function POST(req: NextRequest) {
  const creds = resolveCreds(req.headers);
  const result = await testConnection(creds);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
