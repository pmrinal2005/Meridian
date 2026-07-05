import { NextRequest, NextResponse } from "next/server";
import { align } from "@/lib/align";
import { improve, cogneeMode, resolveCreds } from "@/lib/cognee";

export const runtime = "nodejs";

// Compose / schedule / resolve a resolution ritual.
// Generates a downloadable .ics (no paid calendar API needed).
export async function POST(req: NextRequest) {
  const { subjectId, action, resolvedBelief } = await req.json().catch(() => ({}));
  const creds = resolveCreds(req.headers);
  const report = align(subjectId);
  const ritual = report.ritual;
  if (!ritual) return NextResponse.json({ error: "no ritual for this subject" }, { status: 404 });

  if (action === "schedule") {
    const ics = buildICS(ritual.title, ritual.agenda.join("\\n"));
    return NextResponse.json({ ritual: { ...ritual, status: "scheduled" }, ics, cognee: cogneeMode(req.headers) });
  }

  if (action === "resolve") {
    // Resolved belief flows back into improve() as feedback.
    const imp = await improve({ sessionIds: [`ritual-${subjectId}`], feedbackAlpha: 0.1, creds });
    return NextResponse.json({
      ritual: { ...ritual, status: "resolved", resolvedBelief },
      improve: imp,
      cognee: cogneeMode(req.headers),
    });
  }

  return NextResponse.json({ ritual, cognee: cogneeMode(req.headers) });
}

function buildICS(title: string, description: string): string {
  const now = new Date();
  const start = new Date(now.getTime() + 24 * 3600 * 1000);
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Meridian//Alignment Ritual//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@meridian`,
    `DTSTAMP:${fmt(now)}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
