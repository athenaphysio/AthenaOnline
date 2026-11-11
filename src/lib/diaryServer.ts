import "server-only";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { elapsedWeeks, sessionDate } from "@/lib/programmeWeek";
import {
  cleanSlotLength,
  cleanSlotLocation,
  londonToUtc,
  londonDateKey,
  type SlotLocation,
  type SlotSummary,
} from "@/lib/diary";
import { removeSlotFromGoogle, syncSlotToGoogle } from "@/lib/googleCalendar";

// Everything the diary planner reads and writes, shared by the client's own
// planner and the PA's planner link. Callers prove who they are first; from
// here on a patient id is trusted.

export type PlannerViewer = "client" | "pa" | "clinic";

export type PlannerSession = {
  programmeWorkoutId: string;
  /** What the viewer sees: the session's own name for the client and
   * David, a plain "Practice" or "Cardio practice" for a PA. */
  label: string;
  /** Set when David put this session on one particular day. */
  fixedDate: string | null;
  slot: SlotSummary | null;
};

export type PlannerWeek = {
  programmeId: string;
  programmeTitle: string;
  weekNumber: number;
  /** First and last day of the week, as "2026-11-09". */
  firstDate: string;
  lastDate: string;
  sessions: PlannerSession[];
};

export type PlannerData = {
  firstName: string;
  weeks: PlannerWeek[];
  google: { connected: boolean; email: string | null; lastError: string | null };
};

type ProgrammeRow = { id: string; title: string; start_date: string; block_length_weeks: number };
type AssignmentRow = {
  id: string;
  programme_id: string;
  day_of_week: number | null;
  week_number: number | null;
  sort_order: number;
  workouts: { name: string; kind: string | null } | null;
};
type SlotRow = {
  id: string;
  programme_workout_id: string;
  week_number: number;
  starts_at: string;
  duration_minutes: number;
  location: SlotLocation;
  placed_by: "client" | "pa" | "clinic";
  google_event_id: string | null;
  google_sync_error: string | null;
};

const dateKey = (d: Date) => d.toISOString().slice(0, 10);

function toSummary(s: SlotRow): SlotSummary {
  return {
    id: s.id,
    startsAt: s.starts_at,
    durationMinutes: s.duration_minutes,
    location: s.location,
    placedBy: s.placed_by,
    googleSynced: Boolean(s.google_event_id),
    googleError: s.google_sync_error,
  };
}

// Scheduled programmes the client is in right now (not paused, not past
// their last week). Open routines have no weeks, so nothing to place.
async function activeProgrammes(patientId: string): Promise<ProgrammeRow[]> {
  const { data } = await supabaseAdmin
    .from("programmes")
    .select("id, title, start_date, block_length_weeks")
    .eq("patient_id", patientId)
    .eq("delivery_mode", "scheduled")
    .is("access_paused_at", null)
    .returns<ProgrammeRow[]>();
  return (data ?? []).filter((p) => p.start_date && elapsedWeeks(p.start_date) < p.block_length_weeks);
}

export async function loadPlanner(patientId: string, viewer: PlannerViewer): Promise<PlannerData> {
  const [{ data: patient }, programmes, { data: google }] = await Promise.all([
    supabaseAdmin.from("patients").select("first_name").eq("id", patientId).maybeSingle<{ first_name: string | null }>(),
    activeProgrammes(patientId),
    supabaseAdmin
      .from("google_calendar_connections")
      .select("google_email, last_error")
      .eq("patient_id", patientId)
      .maybeSingle<{ google_email: string | null; last_error: string | null }>(),
  ]);

  const programmeIds = programmes.map((p) => p.id);
  const [{ data: assignments }, { data: slots }] = programmeIds.length
    ? await Promise.all([
        supabaseAdmin
          .from("programme_workouts")
          .select("id, programme_id, day_of_week, week_number, sort_order, workouts(name, kind)")
          .in("programme_id", programmeIds)
          .returns<AssignmentRow[]>(),
        supabaseAdmin
          .from("diary_slots")
          .select("id, programme_workout_id, week_number, starts_at, duration_minutes, location, placed_by, google_event_id, google_sync_error")
          .eq("patient_id", patientId)
          .in("programme_id", programmeIds)
          .returns<SlotRow[]>(),
      ])
    : [{ data: [] as AssignmentRow[] }, { data: [] as SlotRow[] }];

  const slotByKey = new Map((slots ?? []).map((s) => [`${s.programme_workout_id}:${s.week_number}`, s]));
  const weeks: PlannerWeek[] = [];

  for (const p of programmes) {
    const current = elapsedWeeks(p.start_date) + 1;
    // This week and next, so a PA can plan ahead on a Friday.
    for (const weekNumber of [current, current + 1]) {
      if (weekNumber < 1 || weekNumber > p.block_length_weeks) continue;
      const rows = (assignments ?? [])
        .filter((a) => a.programme_id === p.id && (a.week_number == null || a.week_number === weekNumber))
        .sort((a, b) => (a.day_of_week ?? 8) - (b.day_of_week ?? 8) || a.sort_order - b.sort_order);
      if (rows.length === 0) continue;
      let practiceCount = 0;
      const sessions: PlannerSession[] = rows.map((r) => {
        const isCardio = r.workouts?.kind === "cardio";
        practiceCount += 1;
        const label =
          viewer === "pa" ? `${isCardio ? "Cardio practice" : "Practice"} ${practiceCount}` : r.workouts?.name || `Practice ${practiceCount}`;
        const slot = slotByKey.get(`${r.id}:${weekNumber}`);
        return {
          programmeWorkoutId: r.id,
          label,
          fixedDate: r.day_of_week ? dateKey(sessionDate(p.start_date, weekNumber, r.day_of_week)) : null,
          slot: slot ? toSummary(slot) : null,
        };
      });
      weeks.push({
        programmeId: p.id,
        // A PA sees no programme names either.
        programmeTitle: viewer === "pa" ? "Practice" : p.title,
        weekNumber,
        firstDate: dateKey(sessionDate(p.start_date, weekNumber, 1)),
        lastDate: dateKey(sessionDate(p.start_date, weekNumber, 7)),
        sessions,
      });
    }
  }

  weeks.sort((a, b) => a.firstDate.localeCompare(b.firstDate));
  return {
    firstName: patient?.first_name ?? "",
    weeks,
    google: { connected: Boolean(google), email: google?.google_email ?? null, lastError: google?.last_error ?? null },
  };
}

export type SaveSlotInput = {
  programmeWorkoutId: unknown;
  weekNumber: unknown;
  date: unknown;
  time: unknown;
  durationMinutes: unknown;
  location: unknown;
};

// Places (or moves) one session. Checks that the session belongs to this
// client, that the week is real, and that the date sits inside that week
// (or on the session's own day, if David fixed one).
export async function saveSlot(
  patientId: string,
  input: SaveSlotInput,
  placedBy: "client" | "pa" | "clinic",
): Promise<{ ok: true; slot: SlotSummary } | { ok: false; error: string }> {
  const duration = cleanSlotLength(input.durationMinutes);
  const location = cleanSlotLocation(input.location);
  const weekNumber = Number(input.weekNumber);
  if (!duration) return { ok: false, error: "Choose how long the slot is." };
  if (!location) return { ok: false, error: "Choose where the slot is." };
  if (typeof input.programmeWorkoutId !== "string" || !Number.isInteger(weekNumber)) return { ok: false, error: "That session wasn't found." };
  if (typeof input.date !== "string" || typeof input.time !== "string") return { ok: false, error: "Choose a day and a time." };
  const startsAt = londonToUtc(input.date, input.time);
  if (!startsAt) return { ok: false, error: "Choose a day and a time." };

  const { data: row } = await supabaseAdmin
    .from("programme_workouts")
    .select("id, programme_id, day_of_week, week_number, programmes!inner(patient_id, start_date, block_length_weeks)")
    .eq("id", input.programmeWorkoutId)
    .maybeSingle<{
      id: string;
      programme_id: string;
      day_of_week: number | null;
      week_number: number | null;
      programmes: { patient_id: string; start_date: string; block_length_weeks: number };
    }>();
  if (!row || row.programmes.patient_id !== patientId) return { ok: false, error: "That session wasn't found." };
  if (weekNumber < 1 || weekNumber > row.programmes.block_length_weeks) return { ok: false, error: "That week isn't part of the programme." };
  if (row.week_number != null && row.week_number !== weekNumber) return { ok: false, error: "That session isn't in that week." };

  const chosenDay = londonDateKey(startsAt);
  if (row.day_of_week) {
    const fixed = dateKey(sessionDate(row.programmes.start_date, weekNumber, row.day_of_week));
    if (chosenDay !== fixed) return { ok: false, error: "This session is set for one particular day, so only the time can change." };
  } else {
    const first = dateKey(sessionDate(row.programmes.start_date, weekNumber, 1));
    const last = dateKey(sessionDate(row.programmes.start_date, weekNumber, 7));
    if (chosenDay < first || chosenDay > last) return { ok: false, error: "Choose a day inside that week." };
  }

  const { data: saved, error } = await supabaseAdmin
    .from("diary_slots")
    .upsert(
      {
        patient_id: patientId,
        programme_id: row.programme_id,
        programme_workout_id: row.id,
        week_number: weekNumber,
        starts_at: startsAt.toISOString(),
        duration_minutes: duration,
        location,
        placed_by: placedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "programme_workout_id,week_number" },
    )
    .select("id")
    .single<{ id: string }>();
  if (error || !saved) return { ok: false, error: "The slot couldn't be saved. Try again in a moment." };

  await syncSlotToGoogle(saved.id);
  const { data: fresh } = await supabaseAdmin
    .from("diary_slots")
    .select("id, programme_workout_id, week_number, starts_at, duration_minutes, location, placed_by, google_event_id, google_sync_error")
    .eq("id", saved.id)
    .single<SlotRow>();
  return { ok: true, slot: toSummary(fresh!) };
}

export async function deleteSlot(patientId: string, slotId: unknown): Promise<boolean> {
  if (typeof slotId !== "string") return false;
  const { data: slot } = await supabaseAdmin
    .from("diary_slots")
    .select("id, google_event_id")
    .eq("id", slotId)
    .eq("patient_id", patientId)
    .maybeSingle<{ id: string; google_event_id: string | null }>();
  if (!slot) return false;
  await removeSlotFromGoogle(patientId, slot.google_event_id);
  const { error } = await supabaseAdmin.from("diary_slots").delete().eq("id", slot.id);
  return !error;
}

// The slot for one session in one week, for the client's practice screen.
export async function slotForSession(programmeWorkoutId: string, weekNumber: number): Promise<SlotSummary | null> {
  const { data } = await supabaseAdmin
    .from("diary_slots")
    .select("id, programme_workout_id, week_number, starts_at, duration_minutes, location, placed_by, google_event_id, google_sync_error")
    .eq("programme_workout_id", programmeWorkoutId)
    .eq("week_number", weekNumber)
    .maybeSingle<SlotRow>();
  return data ? toSummary(data) : null;
}

// ---- The PA's planner link ----

export type PlannerLink = { id: string; paName: string; token: string; createdAt: string; lastUsedAt: string | null };

export async function activeLinks(patientId: string): Promise<PlannerLink[]> {
  const { data } = await supabaseAdmin
    .from("diary_planner_links")
    .select("id, pa_name, token, created_at, last_used_at")
    .eq("patient_id", patientId)
    .is("revoked_at", null)
    .order("created_at")
    .returns<{ id: string; pa_name: string; token: string; created_at: string; last_used_at: string | null }[]>();
  return (data ?? []).map((l) => ({ id: l.id, paName: l.pa_name, token: l.token, createdAt: l.created_at, lastUsedAt: l.last_used_at }));
}

export async function createLink(patientId: string, paName: string): Promise<PlannerLink | null> {
  const token = randomBytes(24).toString("base64url");
  const { data, error } = await supabaseAdmin
    .from("diary_planner_links")
    .insert({ patient_id: patientId, token, pa_name: paName.slice(0, 80) })
    .select("id, pa_name, token, created_at, last_used_at")
    .single<{ id: string; pa_name: string; token: string; created_at: string; last_used_at: string | null }>();
  if (error || !data) return null;
  return { id: data.id, paName: data.pa_name, token: data.token, createdAt: data.created_at, lastUsedAt: data.last_used_at };
}

export async function revokeLink(patientId: string, linkId: unknown): Promise<boolean> {
  if (typeof linkId !== "string") return false;
  const { error } = await supabaseAdmin
    .from("diary_planner_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .eq("patient_id", patientId);
  return !error;
}

// Who a planner link belongs to, or null if it is unknown, revoked, or the
// planner has since been switched off for that client.
export async function patientForToken(token: unknown): Promise<{ patientId: string; linkId: string; paName: string } | null> {
  if (typeof token !== "string" || token.length < 20) return null;
  const { data } = await supabaseAdmin
    .from("diary_planner_links")
    .select("id, patient_id, pa_name, revoked_at, patients!inner(diary_planner_enabled)")
    .eq("token", token)
    .maybeSingle<{ id: string; patient_id: string; pa_name: string; revoked_at: string | null; patients: { diary_planner_enabled: boolean } }>();
  if (!data || data.revoked_at || !data.patients.diary_planner_enabled) return null;
  return { patientId: data.patient_id, linkId: data.id, paName: data.pa_name };
}

export async function touchLink(linkId: string): Promise<void> {
  await supabaseAdmin.from("diary_planner_links").update({ last_used_at: new Date().toISOString() }).eq("id", linkId);
}

export async function plannerEnabled(patientId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("patients")
    .select("diary_planner_enabled")
    .eq("id", patientId)
    .maybeSingle<{ diary_planner_enabled: boolean }>();
  return data?.diary_planner_enabled === true;
}

// ---- Equipment at each location ----

export async function locationEquipment(patientId: string): Promise<Record<SlotLocation, string[]>> {
  const { data } = await supabaseAdmin
    .from("diary_location_equipment")
    .select("location, equipment_ids")
    .eq("patient_id", patientId)
    .returns<{ location: SlotLocation; equipment_ids: string[] }[]>();
  const out: Record<SlotLocation, string[]> = { home: [], office: [], gym: [], hotel: [], travel: [] };
  for (const r of data ?? []) out[r.location] = r.equipment_ids ?? [];
  return out;
}

// For each exercise that needs equipment the client hasn't got at this
// location, the names of what it needs. An exercise tagged with several
// pieces counts as possible if any one of them is there, and nothing is
// flagged at a location David hasn't filled in.
export async function missingEquipment(patientId: string, location: SlotLocation, exerciseIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (exerciseIds.length === 0) return out;
  const available = new Set((await locationEquipment(patientId))[location]);
  if (available.size === 0) return out;
  const { data } = await supabaseAdmin
    .from("exercise_equipment")
    .select("exercise_id, equipment_id, equipment(name)")
    .in("exercise_id", exerciseIds)
    .returns<{ exercise_id: string; equipment_id: string; equipment: { name: string } | null }[]>();
  const byExercise = new Map<string, { id: string; name: string }[]>();
  for (const r of data ?? []) {
    if (!byExercise.has(r.exercise_id)) byExercise.set(r.exercise_id, []);
    byExercise.get(r.exercise_id)!.push({ id: r.equipment_id, name: r.equipment?.name ?? "equipment" });
  }
  for (const [exerciseId, needs] of byExercise) {
    if (needs.length > 0 && !needs.some((n) => available.has(n.id))) out.set(exerciseId, needs.map((n) => n.name));
  }
  return out;
}
