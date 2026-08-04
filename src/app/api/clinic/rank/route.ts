import { NextRequest, NextResponse } from "next/server";
import { rankBlocks, rankExercises, type RankContext } from "@/lib/rankLibrary";
import type { SlotType } from "@/lib/slotTypes";

// A ranking call is a small, low-effort request meant to feel instant in the
// picker -- nowhere near the AI-draft/scaffold budget.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { pool, slot_type, context } = body as {
    pool: "exercises" | "blocks";
    slot_type?: SlotType;
    context: RankContext;
  };

  if (pool !== "exercises" && pool !== "blocks") {
    return NextResponse.json({ error: "pool must be 'exercises' or 'blocks'." }, { status: 400 });
  }
  if (pool === "blocks" && !slot_type) {
    return NextResponse.json({ error: "slot_type is required when pool is 'blocks'." }, { status: 400 });
  }

  const rankContext: RankContext = {
    focus: context?.focus ?? "",
    equipment: context?.equipment ?? "",
    experienceLevel: context?.experienceLevel ?? "",
    tags: context?.tags ?? [],
  };

  try {
    const picks = pool === "exercises" ? await rankExercises(rankContext) : await rankBlocks(slot_type!, rankContext);
    return NextResponse.json({ picks });
  } catch (err) {
    console.error("rank library failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Ranking failed: ${detail}` }, { status: 500 });
  }
}
