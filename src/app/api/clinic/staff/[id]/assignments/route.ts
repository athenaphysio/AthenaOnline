import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { template_id } = body as { template_id: string };

  if (!template_id) {
    return NextResponse.json({ error: "template_id is required." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("coach_template_assignments").insert({ coach_id: id, template_id });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const templateId = request.nextUrl.searchParams.get("template_id");

  if (!templateId) {
    return NextResponse.json({ error: "template_id is required." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("coach_template_assignments")
    .delete()
    .eq("coach_id", id)
    .eq("template_id", templateId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
