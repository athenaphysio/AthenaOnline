import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DAY_MS = 24 * 60 * 60 * 1000;

type Programme = { id: string; patient_id: string; title: string; start_date: string; block_length_weeks: number };
type Named = { id: string; first_name: string | null; last_name: string | null };

function name(p: Named | undefined): string {
  return p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || "A client" : "A client";
}

function blockEnd(p: Programme): Date {
  return new Date(new Date(p.start_date).getTime() + p.block_length_weeks * 7 * DAY_MS);
}

// Builds the Monday digest: everything from the last seven days that needs
// David, client by client, and nothing about clients who are simply getting
// on with it. Returns null when there is nothing to say.
export async function buildWeeklyDigest(now = new Date()): Promise<{ subject: string; body: string; count: number } | null> {
  const since = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const weekAhead = new Date(now.getTime() + 7 * DAY_MS);

  const [
    { data: patients },
    { data: programmes },
    { data: voiceNotes },
    { data: events },
    { data: completions },
    { data: cardLogs },
    { data: responses },
    { data: registrations },
    { data: drafts },
  ] = await Promise.all([
    supabaseAdmin.from("patients").select("id, first_name, last_name, awaiting_approval").returns<(Named & { awaiting_approval: boolean })[]>(),
    supabaseAdmin
      .from("programmes")
      .select("id, patient_id, title, start_date, block_length_weeks")
      .eq("delivery_mode", "scheduled")
      .is("access_paused_at", null)
      .not("patient_id", "is", null)
      .returns<Programme[]>(),
    supabaseAdmin.from("voice_notes").select("patient_id, transcript").is("read_at", null).returns<{ patient_id: string; transcript: string }[]>(),
    supabaseAdmin.from("programme_events").select("patient_id, kind, week_number").gte("created_at", since).returns<{ patient_id: string; kind: string; week_number: number }[]>(),
    supabaseAdmin.from("session_completions").select("patient_id").gte("occurred_at", since).returns<{ patient_id: string }[]>(),
    supabaseAdmin.from("programme_card_logs").select("patient_id").gte("completed_at", since).returns<{ patient_id: string }[]>(),
    supabaseAdmin
      .from("form_responses")
      .select("patient_id, form_sends(forms(title))")
      .gte("submitted_at", since)
      .returns<{ patient_id: string; form_sends: { forms: { title: string } | null } | null }[]>(),
    supabaseAdmin.from("registrations").select("first_name, last_name").is("claimed_patient_id", null).returns<{ first_name: string; last_name: string }[]>(),
    supabaseAdmin.from("imported_plans").select("patient_id, block_title").eq("status", "draft").returns<{ patient_id: string; block_title: string }[]>(),
  ]);

  const byId = new Map((patients ?? []).map((p) => [p.id, p]));
  // The newest live programme per client.
  const current = new Map<string, Programme>();
  for (const p of (programmes ?? []).sort((a, b) => a.start_date.localeCompare(b.start_date))) current.set(p.patient_id, p);
  const practised = new Set([...(completions ?? []), ...(cardLogs ?? [])].map((r) => r.patient_id));

  const sections: { heading: string; lines: string[] }[] = [];
  const add = (heading: string, lines: string[]) => {
    if (lines.length) sections.push({ heading, lines });
  };

  // Voice notes waiting to be read.
  const notesBy = new Map<string, string[]>();
  for (const v of voiceNotes ?? []) notesBy.set(v.patient_id, [...(notesBy.get(v.patient_id) ?? []), v.transcript]);
  add(
    "Voice notes to listen to",
    [...notesBy].map(([pid, ts]) => `${name(byId.get(pid))}: ${ts.length} new. "${ts[ts.length - 1].slice(0, 90).trim()}${ts[ts.length - 1].length > 90 ? "..." : ""}"`)
  );

  // Flare ups and repeated weeks.
  add(
    "Flare ups and repeated weeks",
    (events ?? []).map((e) => `${name(byId.get(e.patient_id))}: ${e.kind === "flare_up" ? "flare up" : "repeated"} in week ${e.week_number}`)
  );

  // On a live programme, a week or more in, with nothing logged this week.
  add(
    "No practice logged in the last seven days",
    [...current.values()]
      .filter((p) => {
        const started = new Date(p.start_date).getTime();
        return started < now.getTime() - 7 * DAY_MS && blockEnd(p) > now && !practised.has(p.patient_id);
      })
      .map((p) => `${name(byId.get(p.patient_id))}: ${p.title}`)
  );

  // Blocks ending in the next seven days: time to plan the next one.
  add(
    "Blocks ending this week, next block to plan",
    [...current.values()]
      .filter((p) => blockEnd(p) > now && blockEnd(p) <= weekAhead)
      .map((p) => `${name(byId.get(p.patient_id))}: ${p.title} ends ${blockEnd(p).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}`)
  );

  add(
    "Forms filled in",
    (responses ?? []).map((r) => `${name(byId.get(r.patient_id))}: ${r.form_sends?.forms?.title ?? "a form"}`)
  );

  add(
    "Drafts from Claude waiting to open in the builder",
    (drafts ?? []).map((d) => `${name(byId.get(d.patient_id))}: ${d.block_title}`)
  );

  add(
    "Waiting for you to approve or confirm",
    [
      ...(patients ?? []).filter((p) => p.awaiting_approval).map((p) => `${name(p)}: account waiting for Approve`),
      ...(registrations ?? []).map((r) => `${r.first_name} ${r.last_name}: registration not yet matched to an account`),
    ]
  );

  const count = sections.reduce((n, s) => n + s.lines.length, 0);
  if (count === 0) return null;
  const subject = `Your week ahead: ${count} thing${count === 1 ? "" : "s"} that need you`;
  const body = sections.map((s) => `${s.heading.toUpperCase()}\n${s.lines.map((l) => `• ${l}`).join("\n")}`).join("\n\n");
  return { subject, body, count };
}
