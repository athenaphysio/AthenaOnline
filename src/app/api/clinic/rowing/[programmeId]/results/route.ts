import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { paceFromResult } from "@/lib/rowing/zones";
import { loadRowingContext, fileSuggestions } from "@/lib/rowing/rowingServer";

// A row typed in by hand from a PM5 screen, for clients who don't use
// ErgData. Time arrives as minutes and seconds.
export async function POST(request: NextRequest, { params }: { params: Promise<{ programmeId: string }> }) {
  const { programmeId } = await params;
  const body = await request.json();
  const { rowed_on, distance_m, minutes, seconds, stroke_rate, avg_hr, is_test, note } = body as {
    rowed_on?: string;
    distance_m?: number;
    minutes?: number;
    seconds?: number;
    stroke_rate?: number | null;
    avg_hr?: number | null;
    is_test?: boolean;
    note?: string;
  };
  const totalSeconds = Number(minutes || 0) * 60 + Number(seconds || 0);
  if (!rowed_on || !/^\d{4}-\d{2}-\d{2}$/.test(rowed_on)) return NextResponse.json({ error: "Add the date of the row." }, { status: 400 });
  if (!(Number(distance_m) > 0) || !(totalSeconds > 0)) return NextResponse.json({ error: "Add the distance and the time." }, { status: 400 });

  const ctx = await loadRowingContext(programmeId);
  if (!ctx) return NextResponse.json({ error: "This rowing plan could not be found." }, { status: 404 });

  const { error } = await supabaseAdmin.from("rowing_results").insert({
    patient_id: ctx.programme.patient_id,
    source: "manual",
    sport: ctx.sport,
    rowed_on,
    distance_m: Math.round(Number(distance_m)),
    time_tenths: Math.round(totalSeconds * 10),
    avg_split_seconds: paceFromResult(ctx.sport, Number(distance_m), totalSeconds),
    stroke_rate: stroke_rate ? Math.round(stroke_rate) : null,
    avg_hr: avg_hr ? Math.round(avg_hr) : null,
    workout_type: is_test ? "ManualTest" : "JustRow",
    note: note?.trim() || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const fresh = await loadRowingContext(programmeId);
  const filed = fresh ? await fileSuggestions(fresh) : 0;
  return NextResponse.json({ ok: true, suggestions: filed });
}
