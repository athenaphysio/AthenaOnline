import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  PASSPORT_DOMAINS,
  rangeStatus,
  trendFor,
  type PassportDomainKey,
  type PassportMarker,
  type PassportResult,
  type RangeStatus,
  type Trend,
} from "@/lib/passport";

export type MarkerSeries = {
  marker: PassportMarker;
  results: PassportResult[]; // oldest first
  latest: PassportResult;
  status: RangeStatus;
  trend: Trend;
};

export type DomainSummary = {
  key: PassportDomainKey;
  name: string;
  blurb: string;
  colour: string;
  series: MarkerSeries[];
  counts: Record<RangeStatus, number>;
  improving: number;
  lastUpdated: string | null;
};

const MARKER_COLUMNS =
  "marker_key, domain, panel, name, unit, explanation, range_low, range_high, optimal_low, optimal_high, better, sort_order";
const RESULT_COLUMNS = "id, marker_key, value, timepoint, taken_on, source, clinician_note, status";

// Client side: runs under the client's own login, so the database itself
// only ever returns their own released results. Drafts never reach here.
export async function loadClientPassport(supabase: SupabaseClient, patientId: string): Promise<DomainSummary[]> {
  const [{ data: results }, { data: markers }] = await Promise.all([
    supabase
      .from("passport_results")
      .select(RESULT_COLUMNS)
      .eq("patient_id", patientId)
      .eq("status", "released")
      .order("taken_on", { ascending: true })
      .returns<PassportResult[]>(),
    supabase.from("passport_markers").select(MARKER_COLUMNS).returns<PassportMarker[]>(),
  ]);
  return buildSummaries(markers ?? [], results ?? []);
}

// Clinic side: every result for the client, drafts included.
export async function loadClinicPassport(patientId: string) {
  const [{ data: results }, { data: markers }, { data: patient }] = await Promise.all([
    supabaseAdmin
      .from("passport_results")
      .select(RESULT_COLUMNS)
      .eq("patient_id", patientId)
      .order("taken_on", { ascending: true })
      .returns<PassportResult[]>(),
    supabaseAdmin.from("passport_markers").select(MARKER_COLUMNS).returns<PassportMarker[]>(),
    supabaseAdmin
      .from("patients")
      .select("first_name, last_name, passport_enabled")
      .eq("id", patientId)
      .maybeSingle<{ first_name: string | null; last_name: string | null; passport_enabled: boolean }>(),
  ]);
  return { results: results ?? [], markers: markers ?? [], patient };
}

export function buildSummaries(markers: PassportMarker[], results: PassportResult[]): DomainSummary[] {
  const markerByKey = new Map(markers.map((m) => [m.marker_key, m]));
  const resultsByMarker = new Map<string, PassportResult[]>();
  for (const r of results) {
    const list = resultsByMarker.get(r.marker_key) ?? [];
    list.push(r);
    resultsByMarker.set(r.marker_key, list);
  }

  const series: MarkerSeries[] = [];
  for (const [key, list] of resultsByMarker) {
    const marker = markerByKey.get(key);
    if (!marker || list.length === 0) continue;
    const sorted = [...list].sort((a, b) => a.taken_on.localeCompare(b.taken_on));
    const latest = sorted[sorted.length - 1];
    series.push({
      marker,
      results: sorted,
      latest,
      status: rangeStatus(Number(latest.value), marker),
      trend: trendFor(sorted.map((r) => Number(r.value)), marker),
    });
  }

  return PASSPORT_DOMAINS.map((d) => {
    const own = series
      .filter((s) => s.marker.domain === d.key)
      .sort((a, b) => a.marker.sort_order - b.marker.sort_order || (a.marker.panel ?? "").localeCompare(b.marker.panel ?? "") || a.marker.name.localeCompare(b.marker.name));
    const counts: Record<RangeStatus, number> = { optimal: 0, in_range: 0, worth_a_conversation: 0, no_range: 0 };
    for (const s of own) counts[s.status]++;
    const lastUpdated = own.reduce<string | null>((acc, s) => (acc == null || s.latest.taken_on > acc ? s.latest.taken_on : acc), null);
    return {
      key: d.key,
      name: d.name,
      blurb: d.blurb,
      colour: d.colour,
      series: own,
      counts,
      improving: own.filter((s) => s.trend === "improving").length,
      lastUpdated,
    };
  });
}

// Shared gate for the client's passport pages: logged in, and switched on
// by David. Anyone else is sent back to their dashboard.
export async function requirePassportClient(supabase: SupabaseClient): Promise<{ userId: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("patients")
    .select("passport_enabled")
    .eq("id", user.id)
    .maybeSingle<{ passport_enabled: boolean }>();
  return data?.passport_enabled ? { userId: user.id } : null;
}
