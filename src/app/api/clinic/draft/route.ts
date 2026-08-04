import { NextRequest, NextResponse } from "next/server";
import { draftBlock, InvalidBriefError } from "@/lib/draftBlock";

// A large cached prompt + medium-effort thinking, which still routinely
// takes 45-60s+ for a real, detailed clinical brief. This used to be capped
// at 60s (matching "high" effort, which was worse still) -- any brief a
// little longer or more complex than usual got killed mid-request, coming
// back as a plain-text 504 page rather than JSON (see the client-side
// handling in NewProgrammeClient.tsx). Raised well above the typical call
// time so a slow one fails loudly with a real error rather than a timeout.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const brief = typeof body?.brief === "string" ? body.brief : "";
  const blockLengthWeeks = Number(body?.blockLengthWeeks);

  try {
    const draft = await draftBlock(brief, blockLengthWeeks);
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
