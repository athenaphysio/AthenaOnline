import { NextRequest, NextResponse } from "next/server";
import { extractScaffoldBrief } from "@/lib/extractScaffoldBrief";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";

  if (!transcript) {
    return NextResponse.json({ error: "No transcript provided." }, { status: 400 });
  }

  try {
    const fields = await extractScaffoldBrief(transcript);
    return NextResponse.json(fields);
  } catch (error) {
    console.error("scaffold brief extraction failed", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Couldn't read out the details: ${detail}` }, { status: 500 });
  }
}
