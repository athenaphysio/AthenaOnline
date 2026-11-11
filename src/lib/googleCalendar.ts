import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { APP_URL } from "@/lib/appUrl";
import { DIARY_TIME_ZONE, locationLabel } from "@/lib/diary";

// The Google Calendar link. A client signs in once on Google's own page
// and the app creates one calendar in their account, "Athena Training".
// Planned sessions are written there and nowhere else: the permission asked
// for (calendar.app.created) lets the app see and change only calendars it
// created itself, so the rest of the client's diary stays out of reach.
//
// Needs two settings in Vercel, from a Google Cloud project with the Google
// Calendar API switched on (see docs/google-calendar-setup.md):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// The redirect address to register there is
//   <APP_URL>/api/google-calendar/callback

const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.app.created"];
const CALENDAR_NAME = "Athena Training";
const API = "https://www.googleapis.com/calendar/v3";

export function googleCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(): string {
  return `${APP_URL}/api/google-calendar/callback`;
}

export function googleAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    // Always ask, so Google always returns a refresh token, including when
    // a client reconnects after unlinking.
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; id_token?: string; scope?: string };

async function tokenRequest(fields: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...fields,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Google sign in failed (${res.status}).`);
  const data = (await res.json()) as TokenResponse;
  if (!data.access_token) throw new Error("Google didn't return a usable sign in.");
  return data;
}

// The email address inside Google's signed id token. It came straight
// from Google over TLS in the same reply, so reading it is enough here; it
// is only shown back to the client as "connected as".
function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

async function api<T>(token: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const err = new Error(`Google Calendar request failed (${res.status}).`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

type Connection = {
  patient_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  calendar_id: string | null;
};

async function loadConnection(patientId: string): Promise<Connection | null> {
  const { data } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("patient_id, access_token, refresh_token, expires_at, calendar_id")
    .eq("patient_id", patientId)
    .maybeSingle<Connection>();
  return data ?? null;
}

async function freshToken(conn: Connection): Promise<string> {
  if (new Date(conn.expires_at).getTime() - Date.now() > 5 * 60 * 1000) return conn.access_token;
  const token = await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refresh_token });
  await supabaseAdmin
    .from("google_calendar_connections")
    .update({
      access_token: token.access_token,
      expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    })
    .eq("patient_id", conn.patient_id);
  return token.access_token;
}

async function createAthenaCalendar(token: string): Promise<string> {
  const cal = await api<{ id: string }>(token, "/calendars", {
    method: "POST",
    body: {
      summary: CALENDAR_NAME,
      description: `Practice sessions planned with Dr David Silver PhD. Move or delete them in the Athena app, so your programme knows.`,
      timeZone: DIARY_TIME_ZONE,
    },
  });
  return cal.id;
}

// The client has approved on Google's page: keep the tokens, then make the
// Athena Training calendar straight away so it is there before anything is
// planned.
export async function finishGoogleConnect(patientId: string, code: string): Promise<void> {
  const token = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: googleRedirectUri() });
  if (!token.refresh_token) throw new Error("Google didn't return a lasting sign in.");
  const calendarId = await createAthenaCalendar(token.access_token);
  const { error } = await supabaseAdmin.from("google_calendar_connections").upsert({
    patient_id: patientId,
    google_email: emailFromIdToken(token.id_token),
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    calendar_id: calendarId,
    connected_at: new Date().toISOString(),
    last_error: null,
  });
  if (error) throw new Error(error.message);
  // Anything already planned before the link was made goes in now.
  const { data: slots } = await supabaseAdmin
    .from("diary_slots")
    .select("id")
    .eq("patient_id", patientId)
    .gte("starts_at", new Date().toISOString())
    .returns<{ id: string }[]>();
  for (const s of slots ?? []) await syncSlotToGoogle(s.id);
}

// Unlinking forgets the tokens and the stored event ids. The Athena
// Training calendar stays in the client's Google account for them to keep
// or delete, since the app can no longer reach it.
export async function disconnectGoogle(patientId: string): Promise<void> {
  const conn = await loadConnection(patientId);
  if (conn) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conn.refresh_token)}`, { method: "POST" });
    } catch {
      // Removing the tokens below is what matters.
    }
  }
  await supabaseAdmin.from("google_calendar_connections").delete().eq("patient_id", patientId);
  await supabaseAdmin.from("diary_slots").update({ google_event_id: null, google_sync_error: null }).eq("patient_id", patientId);
}

type SlotRow = {
  id: string;
  patient_id: string;
  programme_id: string;
  starts_at: string;
  duration_minutes: number;
  location: string;
  google_event_id: string | null;
  programme_workouts: { workouts: { kind: string | null } | null } | null;
};

// The calendar entry says what kind of practice it is, how long and where,
// and nothing clinical: a PA or anyone the calendar is shared with sees a
// training slot, not a programme.
function eventBody(slot: SlotRow) {
  const start = new Date(slot.starts_at);
  const end = new Date(start.getTime() + slot.duration_minutes * 60 * 1000);
  const kind = slot.programme_workouts?.workouts?.kind === "cardio" ? "Cardio practice" : "Practice";
  return {
    summary: `${kind}, ${slot.duration_minutes} min`,
    location: locationLabel(slot.location),
    description: `Open today's practice in the Athena app: ${APP_URL}/session/${slot.programme_id}`,
    start: { dateTime: start.toISOString(), timeZone: DIARY_TIME_ZONE },
    end: { dateTime: end.toISOString(), timeZone: DIARY_TIME_ZONE },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }] },
    transparency: "opaque",
  };
}

// Writes one slot to the client's Athena Training calendar, creating or
// updating the entry. Never throws: a Google problem is recorded on the slot
// so the planner can say so, and the slot itself is kept either way.
export async function syncSlotToGoogle(slotId: string): Promise<void> {
  const { data: slot } = await supabaseAdmin
    .from("diary_slots")
    .select("id, patient_id, programme_id, starts_at, duration_minutes, location, google_event_id, programme_workouts(workouts(kind))")
    .eq("id", slotId)
    .maybeSingle<SlotRow>();
  if (!slot) return;
  const conn = await loadConnection(slot.patient_id);
  if (!conn) return;

  try {
    const token = await freshToken(conn);
    let calendarId = conn.calendar_id;
    if (!calendarId) {
      calendarId = await createAthenaCalendar(token);
      await supabaseAdmin.from("google_calendar_connections").update({ calendar_id: calendarId }).eq("patient_id", slot.patient_id);
    }
    const cal = encodeURIComponent(calendarId);
    let eventId = slot.google_event_id;
    if (eventId) {
      try {
        await api(token, `/calendars/${cal}/events/${encodeURIComponent(eventId)}`, { method: "PATCH", body: eventBody(slot) });
      } catch (e) {
        // Deleted by hand in Google: make it again rather than give up.
        if ((e as { status?: number }).status === 404 || (e as { status?: number }).status === 410) eventId = null;
        else throw e;
      }
    }
    if (!eventId) {
      try {
        const created = await api<{ id: string }>(token, `/calendars/${cal}/events`, { method: "POST", body: eventBody(slot) });
        eventId = created.id;
      } catch (e) {
        // The client deleted the whole Athena Training calendar: make a new one.
        if ((e as { status?: number }).status !== 404) throw e;
        calendarId = await createAthenaCalendar(token);
        await supabaseAdmin.from("google_calendar_connections").update({ calendar_id: calendarId }).eq("patient_id", slot.patient_id);
        const created = await api<{ id: string }>(token, `/calendars/${encodeURIComponent(calendarId)}/events`, {
          method: "POST",
          body: eventBody(slot),
        });
        eventId = created.id;
      }
    }
    await supabaseAdmin.from("diary_slots").update({ google_event_id: eventId, google_sync_error: null }).eq("id", slot.id);
    await supabaseAdmin.from("google_calendar_connections").update({ last_error: null }).eq("patient_id", slot.patient_id);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Google Calendar could not be reached.";
    await supabaseAdmin.from("diary_slots").update({ google_sync_error: message }).eq("id", slot.id);
    await supabaseAdmin.from("google_calendar_connections").update({ last_error: message }).eq("patient_id", slot.patient_id);
  }
}

// Takes a slot's entry off the calendar before the slot is deleted.
export async function removeSlotFromGoogle(patientId: string, googleEventId: string | null): Promise<void> {
  if (!googleEventId) return;
  const conn = await loadConnection(patientId);
  if (!conn?.calendar_id) return;
  try {
    const token = await freshToken(conn);
    await api(token, `/calendars/${encodeURIComponent(conn.calendar_id)}/events/${encodeURIComponent(googleEventId)}`, { method: "DELETE" });
  } catch {
    // Already gone, or Google is unreachable: the slot is removed regardless.
  }
}
