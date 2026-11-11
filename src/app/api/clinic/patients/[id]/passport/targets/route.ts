import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";

type Body = {
  marker_key?: unknown;
  target_low?: unknown;
  target_high?: unknown;
  target_by?: unknown;
  note?: unknown;
  source?: unknown;
  status?: unknown;
};

const num = (v: unknown): number | null | "bad" => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : "bad";
};

// Set or change one client's target for one marker. Saving always returns
// the target to draft, so a changed target is looked at again before the
// client sees it.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json()) as Body;
  if (typeof body.marker_key !== "string") return NextResponse.json({ error: "Which marker is this target for?" }, { status: 400 });
  const low = num(body.target_low);
  const high = num(body.target_high);
  if (low === "bad" || high === "bad") return NextResponse.json({ error: "A target must be a number." }, { status: 400 });
  if (low == null && high == null) return NextResponse.json({ error: "Set a lower or upper target, or both." }, { status: 400 });
  if (low != null && high != null && low >= high) return NextResponse.json({ error: "The lower target must be below the upper one." }, { status: 400 });
  const by = typeof body.target_by === "string" && body.target_by ? body.target_by : null;
  if (by && !/^\d{4}-\d{2}-\d{2}$/.test(by)) return NextResponse.json({ error: "The date should look like 2027-02-03." }, { status: 400 });
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

  const { error } = await supabaseAdmin.from("passport_targets").upsert(
    {
      patient_id: id,
      marker_key: body.marker_key,
      target_low: low,
      target_high: high,
      target_by: by,
      note: text(body.note, 400),
      source: text(body.source, 300),
      status: "draft",
      released_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "patient_id,marker_key" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Release a target to the client, or take it back to draft. A target can
// only be released once a result for that marker has been released, which
// itself needs a multidisciplinary sign-off.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json()) as Body;
  if (typeof body.marker_key !== "string") return NextResponse.json({ error: "Which marker is this target for?" }, { status: 400 });
  if (body.status !== "draft" && body.status !== "released") return NextResponse.json({ error: "status must be draft or released." }, { status: 400 });
  if (body.status === "released") {
    const { data: released } = await supabaseAdmin
      .from("passport_results")
      .select("id")
      .eq("patient_id", id)
      .eq("marker_key", body.marker_key)
      .eq("status", "released")
      .limit(1);
    if (!released || released.length === 0) {
      return NextResponse.json({ error: "Release a signed off result for this marker first, then its target." }, { status: 409 });
    }
  }
  const { error } = await supabaseAdmin
    .from("passport_targets")
    .update({ status: body.status, released_at: body.status === "released" ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("patient_id", id)
    .eq("marker_key", body.marker_key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json()) as Body;
  if (typeof body.marker_key !== "string") return NextResponse.json({ error: "Which marker is this target for?" }, { status: 400 });
  const { error } = await supabaseAdmin.from("passport_targets").delete().eq("patient_id", id).eq("marker_key", body.marker_key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
