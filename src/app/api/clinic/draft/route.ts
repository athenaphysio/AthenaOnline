import { NextRequest, NextResponse } from "next/server";
import { draftPrescription, InvalidBriefError } from "@/lib/draftProgramme";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const brief = typeof body?.brief === "string" ? body.brief : "";

  try {
    const draft = await draftPrescription(brief);
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof InvalidBriefError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("draft-programme failed", error);
    return NextResponse.json(
      { error: "Something went wrong generating the draft. Please try again." },
      { status: 500 }
    );
  }
}
