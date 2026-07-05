import { NextRequest, NextResponse } from "next/server";
import { liveStatus, resolveCreds, cogneeMode } from "@/lib/cognee";

export const runtime = "nodejs";

// Live tenant status: queries the REAL Cognee dataset for the ingested doc
// count so the UI can show whether the brain actually has data (vs. the
// misleading "connected but empty → falls back to dummy" state). The
// browser forwards its credentials via headers; the key stays server-side.
export async function GET(req: NextRequest) {
  const creds = resolveCreds(req.headers);
  const status = await liveStatus(creds);
  return NextResponse.json({ ...status, cognee: cogneeMode(req.headers) });
}
