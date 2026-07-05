import { NextRequest, NextResponse } from "next/server";
import { lint } from "@/lib/lint";
import { cogneeMode } from "@/lib/cognee";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const findings = lint();
  const summary = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.category] = (acc[f.category] || 0) + 1;
    return acc;
  }, {});
  return NextResponse.json({ findings, summary, cognee: cogneeMode(req.headers) });
}
