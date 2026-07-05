import { NextRequest, NextResponse } from "next/server";
import { CONSTITUTION } from "@/lib/seed";
import { cogneeMode } from "@/lib/cognee";
import type { ConstitutionAmendment } from "@/lib/types";

export const runtime = "nodejs";

// The Alignment Constitution lives inside Cognee as a first-class dataset.
// Amendments require a human-approval click (safety guardrail).
export async function GET() {
  return NextResponse.json({ amendments: CONSTITUTION, cognee: cogneeMode() });
}

// Approve / reject a proposed amendment (human-in-the-loop gate).
export async function POST(req: NextRequest) {
  const { id, action } = await req.json().catch(() => ({}));
  const amendment = CONSTITUTION.find((c) => c.id === id) as ConstitutionAmendment | undefined;
  if (!amendment) return NextResponse.json({ error: "amendment not found" }, { status: 404 });
  if (action === "approve") amendment.status = "approved";
  else if (action === "reject") amendment.status = "rejected";
  return NextResponse.json({ amendment, cognee: cogneeMode() });
}
