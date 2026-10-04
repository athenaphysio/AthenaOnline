import { NextResponse } from "next/server";
import { buildProgrammeLogText } from "@/lib/programmeLog";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const text = await buildProgrammeLogText(id);
  return NextResponse.json({ text });
}
