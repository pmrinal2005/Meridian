import { NextRequest, NextResponse } from "next/server";
import { cogneeMode } from "@/lib/cognee";
import { BELIEFS, STAKEHOLDERS, SUBJECTS } from "@/lib/seed";
import { alignAll } from "@/lib/align";
import { lint } from "@/lib/lint";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const reports = alignAll();
  const avg = reports.reduce((s, r) => s + r.score, 0) / reports.length;
  const findings = lint();
  return NextResponse.json({
    cognee: cogneeMode(req.headers),
    stats: {
      stakeholders: STAKEHOLDERS.length,
      subjects: SUBJECTS.length,
      beliefs: BELIEFS.length,
      avgAlignment: avg,
      openFindings: findings.length,
      highSeverity: findings.filter((f) => f.severity === "high").length,
    },
  });
}
