import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { parsePassportCsv } from "@/lib/passport";

// Takes one filled in upload template (CSV) for one client. Every row lands
// as a draft that only the care team can see. Nothing is saved unless the
// whole file reads cleanly, and each problem is reported by line number.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: patientId } = await params;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Please choose a CSV file to upload." }, { status: 400 });
  }
  if (file.size > 2_000_000) {
    return NextResponse.json({ error: "That file is larger than expected for a results template." }, { status: 400 });
  }

  const { rows, problems } = parsePassportCsv(await file.text());
  if (problems.length) return NextResponse.json({ error: "The file needs a few fixes.", problems }, { status: 400 });
  if (rows.length === 0) return NextResponse.json({ error: "No results were found in the file." }, { status: 400 });

  // Marker library: add any new marker, and update units and ranges from the
  // file. A plain English explanation written in the clinic is never
  // overwritten, since the template does not carry one.
  const markers = new Map(rows.map((r) => [r.marker.marker_key, r.marker]));
  const { error: markerError } = await supabaseAdmin
    .from("passport_markers")
    .upsert(
      Array.from(markers.values()).map((m) => ({ ...m, updated_at: new Date().toISOString() })),
      { onConflict: "marker_key" }
    );
  if (markerError) {
    console.error("passport marker upsert failed", markerError.message);
    return NextResponse.json({ error: `Saving markers failed: ${markerError.message}` }, { status: 500 });
  }

  // Re-uploading the same marker on the same date replaces the value and
  // puts it back into draft for a fresh look before release.
  const results = rows.map((r) => ({
    patient_id: patientId,
    marker_key: r.marker.marker_key,
    ...r.result,
    status: "draft",
    released_at: null,
    updated_at: new Date().toISOString(),
  }));
  const { error: resultError } = await supabaseAdmin
    .from("passport_results")
    .upsert(results, { onConflict: "patient_id,marker_key,taken_on" });
  if (resultError) {
    console.error("passport result upsert failed", resultError.message);
    return NextResponse.json({ error: `Saving results failed: ${resultError.message}` }, { status: 500 });
  }

  return NextResponse.json({ saved: results.length });
}
