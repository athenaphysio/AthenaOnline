import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { APP_URL } from "@/lib/appUrl";
import { splitFromResult } from "@/lib/rowing/zones";

// The Concept2 Logbook link. A client connects once; after that every row
// they do on a PM5 with the ErgData app (or a USB stick, or the PM5's own
// Logbook sync) reaches their Concept2 Logbook, and from there this app.
//
// Needs three settings in Vercel, from the Concept2 developer portal
// (log.concept2.com/developers/keys):
//   CONCEPT2_CLIENT_ID, CONCEPT2_CLIENT_SECRET, and optionally
//   CONCEPT2_BASE_URL (https://log-dev.concept2.com while testing; the
//   live site once Concept2 approves the app). The callback to register is
//   <APP_URL>/api/concept2/callback.

const SCOPE = "user:read,results:read";

function baseUrl(): string {
  return (process.env.CONCEPT2_BASE_URL || "https://log.concept2.com").replace(/\/+$/, "");
}

export function concept2Configured(): boolean {
  return Boolean(process.env.CONCEPT2_CLIENT_ID && process.env.CONCEPT2_CLIENT_SECRET);
}

export function concept2RedirectUri(): string {
  return `${APP_URL}/api/concept2/callback`;
}

export function concept2AuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.CONCEPT2_CLIENT_ID ?? "",
    scope: SCOPE,
    response_type: "code",
    redirect_uri: concept2RedirectUri(),
    state,
  });
  return `${baseUrl()}/oauth/authorize?${params.toString()}`;
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number; scope?: string };

async function tokenRequest(fields: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${baseUrl()}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: process.env.CONCEPT2_CLIENT_ID ?? "",
      client_secret: process.env.CONCEPT2_CLIENT_SECRET ?? "",
      scope: SCOPE,
      ...fields,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Concept2 sign in failed (${res.status}).`);
  const data = (await res.json()) as TokenResponse;
  if (!data.access_token || !data.refresh_token) throw new Error("Concept2 didn't return a usable sign in.");
  return data;
}

async function api<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.c2logbook.v1+json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Concept2 Logbook request failed (${res.status}).`);
  return (await res.json()) as T;
}

export async function finishConcept2Connect(patientId: string, code: string): Promise<void> {
  const token = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: concept2RedirectUri() });
  let userId: number | null = null;
  try {
    const me = await api<{ data: { id: number } }>("/api/users/me", token.access_token);
    userId = me.data?.id ?? null;
  } catch {
    userId = null;
  }
  const { error } = await supabaseAdmin.from("concept2_connections").upsert({
    patient_id: patientId,
    c2_user_id: userId,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    scope: token.scope ?? SCOPE,
    connected_at: new Date().toISOString(),
    last_error: null,
  });
  if (error) throw new Error(error.message);
}

type Connection = {
  patient_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  last_synced_at: string | null;
};

async function freshToken(conn: Connection): Promise<string> {
  if (new Date(conn.expires_at).getTime() - Date.now() > 60 * 60 * 1000) return conn.access_token;
  const token = await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refresh_token });
  await supabaseAdmin
    .from("concept2_connections")
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    })
    .eq("patient_id", conn.patient_id);
  return token.access_token;
}

type C2Interval = {
  type?: string | null;
  time?: number | null;
  distance?: number | null;
  stroke_rate?: number | null;
  rest_time?: number | null;
};

type C2Result = {
  id: number;
  date: string;
  distance: number;
  time: number;
  type: string;
  workout_type?: string | null;
  stroke_rate?: number | null;
  drag_factor?: number | null;
  calories_total?: number | null;
  heart_rate?: { average?: number | null } | null;
  workout?: { intervals?: C2Interval[] | null; splits?: C2Interval[] | null } | null;
};

// Concept2's machine names, as this app stores them.
const SPORT_BY_TYPE: Record<string, "row" | "ski" | "bike"> = { rower: "row", skierg: "ski", bike: "bike" };

// Average watts from pace, Concept2's own formula, for the rower and SkiErg.
// The BikeErg works its watts out differently, so none is given for it here.
function wattsFor(sport: "row" | "ski" | "bike", distanceM: number, seconds: number): number | null {
  if (sport === "bike" || !(distanceM > 0) || !(seconds > 0)) return null;
  return Math.round(2.8 / Math.pow(seconds / distanceM, 3));
}

// One entry per interval (or per split, for a single piece), so the
// Programme Builder can read how the piece was paced.
function intervalsFrom(r: C2Result): { distance_m: number | null; time_tenths: number | null; split_seconds: number | null; stroke_rate: number | null; rest_seconds: number | null }[] {
  const parts = r.workout?.intervals?.length ? r.workout.intervals : r.workout?.splits ?? [];
  return parts.map((i) => {
    const distance = i.distance && i.distance > 0 ? Math.round(i.distance) : null;
    const tenths = i.time && i.time > 0 ? Math.round(i.time) : null;
    return {
      distance_m: distance,
      time_tenths: tenths,
      split_seconds: distance && tenths ? Math.round((tenths / 10 / distance) * 500 * 10) / 10 : null,
      stroke_rate: i.stroke_rate ?? null,
      rest_seconds: i.rest_time && i.rest_time > 0 ? Math.round(i.rest_time / 10) : null,
    };
  });
}

export type SyncOutcome = { connected: boolean; added: number; error: string | null };

/** Pulls the client's rower, SkiErg and BikeErg sessions since a little before the last sync. */
export async function syncConcept2(patientId: string, fromDate: string): Promise<SyncOutcome> {
  if (!concept2Configured()) return { connected: false, added: 0, error: null };
  const { data: conn } = await supabaseAdmin
    .from("concept2_connections")
    .select("patient_id, access_token, refresh_token, expires_at, last_synced_at")
    .eq("patient_id", patientId)
    .maybeSingle<Connection>();
  if (!conn) return { connected: false, added: 0, error: null };

  try {
    const token = await freshToken(conn);
    const since = conn.last_synced_at
      ? new Date(new Date(conn.last_synced_at).getTime() - 3 * 86400000).toISOString().slice(0, 10)
      : fromDate;
    const from = since > fromDate ? since : fromDate;
    const rows: C2Result[] = [];
    for (let page = 1; page <= 5; page++) {
      const data = await api<{ data: C2Result[]; meta?: { pagination?: { total_pages?: number } } }>(
        `/api/users/me/results?from=${from}&number=250&page=${page}`,
        token
      );
      rows.push(...(data.data ?? []));
      const pages = data.meta?.pagination?.total_pages ?? 1;
      if (page >= pages) break;
    }

    const upserts = rows
      .filter((r) => r.distance > 0 && r.time > 0 && SPORT_BY_TYPE[r.type])
      .map((r) => {
        const sport = SPORT_BY_TYPE[r.type];
        return {
          patient_id: patientId,
          c2_result_id: r.id,
          source: "concept2",
          sport,
          rowed_on: r.date.slice(0, 10),
          distance_m: Math.round(r.distance),
          time_tenths: Math.round(r.time),
          avg_split_seconds: splitFromResult(r.distance, r.time / 10),
          stroke_rate: r.stroke_rate ?? null,
          avg_hr: r.heart_rate?.average ?? null,
          workout_type: r.workout_type ?? null,
          avg_watts: wattsFor(sport, r.distance, r.time / 10),
          drag_factor: r.drag_factor ?? null,
          calories: r.calories_total ?? null,
          intervals: intervalsFrom(r),
        };
      });
    if (upserts.length > 0) {
      const { error } = await supabaseAdmin.from("rowing_results").upsert(upserts, { onConflict: "c2_result_id" });
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin
      .from("concept2_connections")
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq("patient_id", patientId);
    return { connected: true, added: upserts.length, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabaseAdmin.from("concept2_connections").update({ last_error: message }).eq("patient_id", patientId);
    return { connected: true, added: 0, error: message };
  }
}

/** The last 12 weeks, which is what the Programme Builder reads. */
export function twelveWeeksAgo(): string {
  return new Date(Date.now() - 84 * 86400000).toISOString().slice(0, 10);
}

/**
 * Pulls every connected client's Concept2 sessions, whether or not they
 * have a rowing plan, so their training reaches the Programme Builder.
 */
export async function syncAllConcept2(): Promise<{ checked: number; added: number; errors: number }> {
  const { data: conns } = await supabaseAdmin.from("concept2_connections").select("patient_id").returns<{ patient_id: string }[]>();
  let checked = 0;
  let added = 0;
  let errors = 0;
  for (const c of conns ?? []) {
    try {
      const out = await syncConcept2(c.patient_id, twelveWeeksAgo());
      checked += 1;
      added += out.added;
      if (out.error) errors += 1;
    } catch {
      errors += 1;
    }
  }
  return { checked, added, errors };
}
