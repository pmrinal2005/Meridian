import { NextRequest, NextResponse } from "next/server";
import { recall, cogneeMode } from "@/lib/cognee";

export const runtime = "nodejs";

// Ask panel → GraphRAG Q&A over the belief graph.
export async function POST(req: NextRequest) {
  const { query, searchType, nodeName } = await req.json().catch(() => ({ query: "" }));
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  const result = await recall(query, { searchType, nodeName });
  return NextResponse.json({ ...result, cognee: cogneeMode() });
}
