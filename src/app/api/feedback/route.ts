import { NextRequest, NextResponse } from "next/server";
import { improve, cogneeMode } from "@/lib/cognee";

export const runtime = "nodejs";

// Thumbs up/down on an align() verdict → feeds feedback_alpha in improve().
// In production this would persist to Supabase; here it acknowledges + reweights.
export async function POST(req: NextRequest) {
  const { targetType, targetId, vote } = await req.json().catch(() => ({}));
  if (![1, -1].includes(vote)) {
    return NextResponse.json({ error: "vote must be 1 or -1" }, { status: 400 });
  }
  const imp = await improve({ feedbackAlpha: vote === 1 ? 0.05 : -0.05, nodeName: [targetId] });
  return NextResponse.json({
    ok: true,
    recorded: { targetType, targetId, vote },
    improve: imp,
    cognee: cogneeMode(),
  });
}
