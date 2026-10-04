import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { usageOf, type TidyKind } from "@/lib/libraryTidy";

const TABLE: Record<TidyKind, string> = { workout: "workouts", block: "blocks", cardio: "cardio_blocks" };

type Result = { kind: TidyKind; id: string; status: "deleted" | "skipped" | "failed"; message?: string };

// Deletes only the items David ticked. Each one is checked again here, so
// anything still used by a saved programme (or a workout, template or client
// log) is skipped and reported rather than removed. Workouts go first, so a
// block that was only used by a ticked workout can then be removed too.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { items } = body as { items?: { kind: TidyKind; id: string }[] };
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Tick at least one item." }, { status: 400 });
  }

  const order: TidyKind[] = ["workout", "block", "cardio"];
  const results: Result[] = [];
  for (const kind of order) {
    for (const item of items.filter((i) => i.kind === kind)) {
      if (!TABLE[item.kind] || typeof item.id !== "string") continue;
      const used = await usageOf(kind, item.id);
      if (used) {
        results.push({ kind, id: item.id, status: "skipped", message: used });
        continue;
      }
      const { error } = await supabaseAdmin.from(TABLE[kind]).delete().eq("id", item.id);
      results.push(error ? { kind, id: item.id, status: "failed", message: error.message } : { kind, id: item.id, status: "deleted" });
    }
  }
  return NextResponse.json({ results });
}
