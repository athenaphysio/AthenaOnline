import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { applyRungToProgramme } from "@/lib/runningProgression";

const FLARE_DAYS = 6;

export type StartFlareResult = { ok: true } | { ok: false; error: string };

// "Having a flare-up?" -- David's own protocol: 5 to 6 days off impact,
// replaced with the one fixed deload plan, then back to the ladder one
// rung lower than wherever the client actually was. See
// 0088_running_flare_up.sql and src/app/api/session/flare-up/route.ts.
export async function startFlare(programmeId: string): Promise<StartFlareResult> {
  const { data: state } = await supabaseAdmin
    .from("running_programme_state")
    .select("id, patient_id, current_rung_number")
    .eq("programme_id", programmeId)
    .maybeSingle<{ id: string; patient_id: string; current_rung_number: number }>();
  if (!state) return { ok: false, error: "This isn't a running programme." };

  const { data: existingFlare } = await supabaseAdmin
    .from("running_flare_events")
    .select("id")
    .eq("programme_id", programmeId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();
  if (existingFlare) return { ok: false, error: "Already on a deload plan." };

  const { data: settings } = await supabaseAdmin
    .from("running_deload_settings")
    .select("deload_workout_id")
    .eq("id", true)
    .maybeSingle<{ deload_workout_id: string }>();
  if (!settings) return { ok: false, error: "No deload plan has been set up yet." };

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + FLARE_DAYS * 24 * 60 * 60 * 1000);

  const { data: flareEvent, error: flareError } = await supabaseAdmin
    .from("running_flare_events")
    .insert({
      programme_id: programmeId,
      patient_id: state.patient_id,
      programme_state_id: state.id,
      pre_flare_rung_number: state.current_rung_number,
      started_at: startedAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .select("id")
    .single<{ id: string }>();
  if (flareError) return { ok: false, error: flareError.message };

  const overrideRows = Array.from({ length: FLARE_DAYS }, (_, i) => {
    const d = new Date(startedAt);
    d.setDate(d.getDate() + i);
    return {
      programme_id: programmeId,
      override_date: d.toISOString().slice(0, 10),
      workout_id: settings.deload_workout_id,
      reason: "flare_up",
      flare_event_id: flareEvent.id,
    };
  });
  const { error: overrideError } = await supabaseAdmin.from("programme_day_overrides").insert(overrideRows);
  if (overrideError) return { ok: false, error: overrideError.message };

  return { ok: true };
}

// Checked once on every session-page load for this programme (see
// [programmeId]/page.tsx) -- lazy rather than a cron, same reasoning as
// evaluateRunProgression: the only thing that needs the answer is whoever
// next opens the app, clinician or client. Idempotent: once a flare is
// marked resolved it's never picked up again.
export async function resolveExpiredFlares(programmeId: string): Promise<void> {
  const { data: expired } = await supabaseAdmin
    .from("running_flare_events")
    .select("id, programme_state_id, pre_flare_rung_number")
    .eq("programme_id", programmeId)
    .eq("status", "active")
    .lte("ends_at", new Date().toISOString())
    .returns<{ id: string; programme_state_id: string; pre_flare_rung_number: number }[]>();
  if (!expired || expired.length === 0) return;

  for (const flare of expired) {
    const { data: state } = await supabaseAdmin
      .from("running_programme_state")
      .select("id, patient_id, ladder_id, quality_run_workout_id, easy_run_workout_id")
      .eq("id", flare.programme_state_id)
      .maybeSingle<{ id: string; patient_id: string; ladder_id: string; quality_run_workout_id: string | null; easy_run_workout_id: string | null }>();
    if (!state) continue;

    const toRung = Math.max(1, flare.pre_flare_rung_number - 1);
    await applyRungToProgramme(state, toRung);
    await supabaseAdmin
      .from("running_programme_state")
      .update({ current_rung_number: toRung, updated_at: new Date().toISOString() })
      .eq("id", state.id);
    await supabaseAdmin.from("running_progression_events").insert({
      programme_state_id: state.id,
      patient_id: state.patient_id,
      kind: "dropped_back",
      status: "approved",
      from_rung_number: flare.pre_flare_rung_number,
      to_rung_number: toRung,
      resolved_at: new Date().toISOString(),
    });
    await supabaseAdmin
      .from("running_flare_events")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", flare.id);
  }
}

// The one place a session date is checked against an override -- used by
// [programmeId]/page.tsx in place of the plain day-of-week lookup,
// whether that's today's own session or a catch-up day.
export async function workoutOverrideFor(programmeId: string, date: Date): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("programme_day_overrides")
    .select("workout_id")
    .eq("programme_id", programmeId)
    .eq("override_date", date.toISOString().slice(0, 10))
    .maybeSingle<{ workout_id: string }>();
  return data?.workout_id ?? null;
}
