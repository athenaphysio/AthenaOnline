import { NextRequest, NextResponse } from "next/server";
import { answerSuggestion } from "@/lib/rowing/rowingServer";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action } = (await request.json()) as { action?: "approve" | "hold" };
  if (action !== "approve" && action !== "hold") return NextResponse.json({ error: "Choose approve or hold." }, { status: 400 });
  try {
    const outcome = await answerSuggestion(id, action);
    return NextResponse.json(outcome);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't apply that." }, { status: 500 });
  }
}
