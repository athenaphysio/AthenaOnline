import { NextResponse } from "next/server";
import { refreshRowing } from "@/lib/rowing/rowingServer";

export async function POST(_request: Request, { params }: { params: Promise<{ programmeId: string }> }) {
  const { programmeId } = await params;
  try {
    const outcome = await refreshRowing(programmeId);
    return NextResponse.json(outcome);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't check the rows." }, { status: 500 });
  }
}
