import { NextRequest, NextResponse } from "next/server";
import { findOrCreateUsageTag, getBlockUsageTagCatalog } from "@/lib/blockUsageTags";

// Client-fetched by builders mounted without a wrapping server component
// (WorkoutEditorInline, opened from the Programme Builder's calendar) --
// mirrors the client-fetchable /api/clinic/exercises alongside it.
export async function GET() {
  try {
    const tags = await getBlockUsageTagCatalog();
    return NextResponse.json({ tags });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to load: ${detail}` }, { status: 500 });
  }
}

// Same draft-list-grows-over-time pattern as equipment and phase tags -- a
// new tag becomes immediately selectable everywhere else since every
// picker reads the same table live. Find-or-create rather than a plain
// insert, so typing a tag that already exists (case-insensitively) from
// the inline add box in the block editor reuses that row instead of
// creating a near-duplicate.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { name?: string };
  const name = body.name;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const tag = await findOrCreateUsageTag(name);
    return NextResponse.json(tag);
  } catch (err) {
    console.error("create block usage tag failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
