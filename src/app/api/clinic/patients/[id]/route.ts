import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Permanently deletes a client and everything held about them in the app.
//
// How the data hangs together: patients.id is the client's login account
// (auth.users.id) and almost every client table cascades from patients, so
// deleting the login account clears the bulk of it in one step. Three
// tables do NOT cascade and would block that delete, so they are cleared
// first: running_builder_drafts, programmes (whose own child tables do
// cascade) and registrations (the original sign-up form, which holds the
// client's personal details). Stored files are removed from their buckets
// too, since those are not touched by database deletes.
//
// Setmore is deliberately left alone: booking and payment history lives
// there and is managed in Setmore itself.
//
// Protected by the clinic password cookie in middleware.ts, like every
// other /api/clinic route.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let confirmName = "";
  try {
    const body = await request.json();
    confirmName = String(body?.confirm_name ?? "").trim().toLowerCase();
  } catch {
    // no body
  }

  const { data: patient, error: patientError } = await supabaseAdmin
    .from("patients")
    .select("id, first_name, photo_path")
    .eq("id", id)
    .maybeSingle();
  if (patientError) {
    return NextResponse.json({ error: `Could not load client: ${patientError.message}` }, { status: 500 });
  }
  if (!patient) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  // Server-side safety check, matching the typed confirmation in the UI.
  if (!confirmName || confirmName !== String(patient.first_name ?? "").trim().toLowerCase()) {
    return NextResponse.json({ error: "Type the client's first name to confirm." }, { status: 400 });
  }

  try {
    // 1. Gather stored file paths before the rows that point to them disappear.
    const [{ data: programmes }, { data: docs }, { data: intake }] = await Promise.all([
      supabaseAdmin.from("programmes").select("id, goal_image_path").eq("patient_id", id),
      supabaseAdmin.from("client_documents").select("storage_path").eq("patient_id", id),
      supabaseAdmin.from("patient_intake_documents").select("storage_path").eq("patient_id", id),
    ]);

    const programmeIds = (programmes ?? []).map((p) => p.id as string);
    const goalImages = (programmes ?? []).map((p) => p.goal_image_path as string | null).filter(Boolean) as string[];
    const documentPaths = (docs ?? []).map((d) => d.storage_path as string).filter(Boolean);
    const intakePaths = (intake ?? []).map((d) => d.storage_path as string).filter(Boolean);

    // 2. Clear the three tables that would otherwise block the delete.
    const del1 = await supabaseAdmin.from("running_builder_drafts").delete().eq("patient_id", id);
    if (del1.error) throw new Error(`running drafts: ${del1.error.message}`);
    if (programmeIds.length) {
      const del1b = await supabaseAdmin.from("running_builder_drafts").delete().in("programme_id", programmeIds);
      if (del1b.error) throw new Error(`running drafts: ${del1b.error.message}`);
      const del2 = await supabaseAdmin.from("programmes").delete().in("id", programmeIds);
      if (del2.error) throw new Error(`programmes: ${del2.error.message}`);
    }
    const del3 = await supabaseAdmin.from("registrations").delete().eq("claimed_patient_id", id);
    if (del3.error) throw new Error(`sign-up record: ${del3.error.message}`);

    // 3. Delete the login account, which cascades to the client record and
    //    all of their linked data.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) {
      // Fall back to deleting the client row directly if the login account
      // is somehow already gone.
      const del4 = await supabaseAdmin.from("patients").delete().eq("id", id);
      if (del4.error) throw new Error(`client record: ${authError.message}; ${del4.error.message}`);
    }

    // 4. Remove stored files. Failures here are logged, not fatal, because
    //    the client record itself is already gone.
    const removals: Array<[string, string[]]> = [
      ["client-photos", patient.photo_path ? [patient.photo_path as string] : []],
      ["patient-goal-images", goalImages],
      ["client-documents", documentPaths],
      ["intake-forms", intakePaths],
    ];
    for (const [bucket, paths] of removals) {
      if (!paths.length) continue;
      const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
      if (error) console.error(`delete client: could not remove files from ${bucket}`, error);
    }

    return NextResponse.json({ deleted: id });
  } catch (err) {
    console.error("delete client failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Delete failed: ${detail}` }, { status: 500 });
  }
}
