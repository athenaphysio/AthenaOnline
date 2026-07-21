import { NextRequest, NextResponse } from "next/server";
import { draftPrescription, InvalidBriefError } from "@/lib/draftProgramme";

// This call routinely takes 40-60s (large cached prompt + high-effort
// thinking). Vercel's default function timeout is well under that.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const brief = typeof body?.brief === "string" ? body.brief : "";
  const blockLengthWeeks = Number(body?.blockLengthWeeks);

  try {
    const draft = await draftPrescription(brief, blockLengthWeeks);
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof InvalidBriefError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // This is a private, password-gated clinician tool — surface the real
    // error rather than a generic message, so a failure is diagnosable
    // without needing to dig through server logs every time.
    console.error("draft-programme failed", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Draft generation failed: ${detail}` },
      { status: 500 }
    );
  }
}
