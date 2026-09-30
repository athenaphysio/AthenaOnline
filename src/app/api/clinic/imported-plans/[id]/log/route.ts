import { NextResponse } from "next/server";
import { buildClaudeLogText } from "@/lib/planLog";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const text = await buildClaudeLogText(id);
  return NextResponse.json({ text });
}
