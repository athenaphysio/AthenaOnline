import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Created bare (text fields only, client-generated id) -- the photo is
// uploaded separately via /api/clinic/friends/[id]/photo, same two-step
// shape as a programme template's cover image.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, name, job_title, bio_text, weblink } = body as {
    id: string;
    name: string;
    job_title?: string | null;
    bio_text?: string | null;
    weblink?: string | null;
  };

  if (!id || !name?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    // New friends go to the end of the list -- David reorders from there.
    const { count } = await supabaseAdmin.from("friends").select("id", { count: "exact", head: true });

    const { error } = await supabaseAdmin.from("friends").insert({
      id,
      name: name.trim(),
      job_title: job_title?.trim() || null,
      bio_text: bio_text?.trim() || null,
      weblink: weblink?.trim() || null,
      sort_order: count ?? 0,
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ id });
  } catch (err) {
    console.error("create friend failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
