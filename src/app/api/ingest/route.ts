import { NextRequest, NextResponse } from "next/server";
import { remember, cogneeMode, resolveCreds, INGEST_DOCS } from "@/lib/cognee";
import type { IngestDoc, SourceType } from "@/lib/types";

export const runtime = "nodejs";

// Ingest a transcript-shaped doc → remember() with node_set tags.
// Accepts either a full doc, or {sample:true} to replay seeded docs.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const creds = resolveCreds(req.headers);

  if (body?.sample) {
    const results = [];
    for (const doc of INGEST_DOCS) {
      results.push(await remember(doc, { sessionId: `session-${new Date().toISOString().slice(0, 10)}`, creds }));
    }
    return NextResponse.json({ results, cognee: cogneeMode(req.headers) });
  }

  const { source, title, transcript, speaker, subject, project } = body;
  if (!transcript || !title) {
    return NextResponse.json({ error: "title and transcript are required" }, { status: 400 });
  }
  const nodeSet: string[] = [`source:${source || "slack"}`];
  if (speaker) nodeSet.push(`speaker:${speaker}`);
  if (subject) nodeSet.push(`subject:${subject}`);
  if (project) nodeSet.push(`project:${project}`);

  const doc: IngestDoc = {
    id: `doc-${Date.now()}`,
    source: (source as SourceType) || "slack",
    title,
    nodeSet,
    transcript,
    at: new Date().toISOString(),
  };
  const result = await remember(doc, { sessionId: `session-${new Date().toISOString().slice(0, 10)}`, creds });
  return NextResponse.json({ result, cognee: cogneeMode(req.headers) });
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ docs: INGEST_DOCS, cognee: cogneeMode(req.headers) });
}
