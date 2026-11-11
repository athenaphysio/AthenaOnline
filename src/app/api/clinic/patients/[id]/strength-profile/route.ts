import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { applyOverrides, cleanOverrides, readStrengthProfile, type StrengthOverrides } from "@/lib/strengthProfile";

async function load(id: string) {
  const [{ data: patient, error: pErr }, { data: entries, error: eErr }] = await Promise.all([
    supabaseAdmin.from("patients").select("strength_profile").eq("id", id).maybeSingle<{ strength_profile: StrengthOverrides | null }>(),
    supabaseAdmin
      .from("client_context_entries")
      .select("summary_text, notes_text")
      .eq("patient_id", id)
      .returns<{ summary_text: string | null; notes_text: string | null }[]>(),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (eErr) throw new Error(eErr.message);
  const texts = (entries ?? []).flatMap((e) => [e.summary_text ?? "", e.notes_text ?? ""]).filter(Boolean);
  const fromNotes = readStrengthProfile(texts);
  return { fromNotes, saved: patient?.strength_profile ?? null, profile: applyOverrides(fromNotes, patient?.strength_profile) };
}

// The client's strength profile: what their notes say, what David has
// corrected, and the two combined, which is what the strength engine builds to.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await load(id));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not read the strength profile." }, { status: 500 });
  }
}

// Saves David's corrections. Sending null clears them, so the profile goes
// back to what the notes say.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { overrides?: unknown };
  let overrides = body.overrides === null ? null : cleanOverrides(body.overrides);
  // David's save confirms every field as his own, but the consultation's
  // free text notes stay so he can still see them.
  if (overrides) {
    const { data: before } = await supabaseAdmin
      .from("patients")
      .select("strength_profile")
      .eq("id", id)
      .maybeSingle<{ strength_profile: StrengthOverrides | null }>();
    if (before?.strength_profile?.consultationNotes) overrides = { ...overrides, consultationNotes: before.strength_profile.consultationNotes };
  }
  const { error } = await supabaseAdmin.from("patients").update({ strength_profile: overrides }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try {
    return NextResponse.json(await load(id));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Saved, but could not read it back." }, { status: 500 });
  }
}
