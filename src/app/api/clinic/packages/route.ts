import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";

// Create a package, or change its name or brand pack.
export async function POST(request: NextRequest) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name } = (await request.json()) as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "A name is required." }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("packages").insert({ name: name.trim() }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as { id?: string; name?: string; brand_pack_id?: string | null };
  if (!body.id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.brand_pack_id !== undefined) update.brand_pack_id = body.brand_pack_id || null;
  const { error } = await supabaseAdmin.from("packages").update(update).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
