import { NextRequest, NextResponse } from "next/server";
import { align, alignAll } from "@/lib/align";
import { cogneeMode } from "@/lib/cognee";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const subjectId = req.nextUrl.searchParams.get("subject");
  if (subjectId) {
    return NextResponse.json({ report: align(subjectId), cognee: cogneeMode() });
  }
  return NextResponse.json({ reports: alignAll(), cognee: cogneeMode() });
}
