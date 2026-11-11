import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  PASSPORT_DOMAINS,
  rangeStatus,
  trendFor,
  withClientRanges,
  type PassportDomainKey,
  type PassportFinding,
  type PassportMarker,
  type PassportResult,
  type PassportTarget,
  type RangeStatus,
  type Trend,
} from "@/lib/passport";

export type MarkerSeries = {
  marker: PassportMarker;
  results: PassportResult[]; // oldest first
  latest: PassportResult;
  status: RangeStatus;
  trend: Trend;
  // The care team's target for this client on this marker, if one is set.
  target: PassportTarget | null;
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
const RESULT_COLUMNS =
  "id, marker_key, value, value_qualifier, range_low, range_high, optimal_low, optimal_high, timepoint, taken_on, source, clinician_note, status";
const TARGET_COLUMNS = "id, marker_key, target_low, target_high, target_by, note, source, status";
const FINDING_COLUMNS =
  "id, category, finding_key, title, result_label, lab_label, detail, remeasured, timepoint, taken_on, source, clinician_note, status";

// Client side: runs under the client's own login, so the database itself
// only ever returns their own released results. Drafts never reach here.
export async function loadClientPassport(supabase: SupabaseClient, patientId: string): Promise<DomainSummary[]> {
  const [{ data: results }, { data: markers }, { data: targets }] = await Promise.all([
    supabase
      .from("passport_results")
      .select(RESULT_COLUMNS)
      .eq("patient_id", patientId)
      .eq("status", "released")
      .order("taken_on", { ascending: true })
      .returns<PassportResult[]>(),
    supabase.from("passport_markers").select(MARKER_COLUMNS).returns<PassportMarker[]>(),
    // The database returns only this client's released targets.
    supabase
      .from("passport_targets")
      .select("id, marker_key, target_low, target_high, target_by, note, status")
      .eq("patient_id", patientId)
      .eq("status", "released")
      .returns<PassportTarget[]>(),
  ]);
  return buildSummaries(markers ?? [], results ?? [], targets ?? []);
}

// One-off results (genetics, food panel, written reports), client side. Runs
// under the client's own login, so the database returns only their own
// released findings.
export async function loadClientFindings(supabase: SupabaseClient, patientId: string): Promise<PassportFinding[]> {
  const { data } = await supabase
    .from("passport_findings")
    .select(FINDING_COLUMNS)
    .eq("patient_id", patientId)
    .eq("status", "released")
    .order("taken_on", { ascending: true })
    .returns<PassportFinding[]>();
  return data ?? [];
}

// One-off results, clinic side: every finding, drafts included. Callers
// for a clinician filter these by the areas that clinician may see.
export async function loadClinicFindings(patientId: string): Promise<PassportFinding[]> {
  const { data } = await supabaseAdmin
    .from("passport_findings")
    .select(FINDING_COLUMNS)
    .eq("patient_id", patientId)
    .order("taken_on", { ascending: true })
    .returns<PassportFinding[]>();
  return data ?? [];
}

export type PassportSignoff = { id: string; taken_on: string; meeting_on: string; clinicians: string; note: string | null };

// Clinic side: every result for the client, drafts included, with the
// multidisciplinary sign-offs recorded for each test date.
export async function loadClinicPassport(patientId: string) {
  const [{ data: results }, { data: markers }, { data: patient }, { data: signoffs }, { data: targets }] = await Promise.all([
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
    supabaseAdmin
      .from("passport_signoffs")
      .select("id, taken_on, meeting_on, clinicians, note")
      .eq("patient_id", patientId)
      .order("taken_on", { ascending: false })
      .returns<PassportSignoff[]>(),
    supabaseAdmin.from("passport_targets").select(TARGET_COLUMNS).eq("patient_id", patientId).returns<PassportTarget[]>(),
  ]);
  return { results: results ?? [], markers: markers ?? [], patient, signoffs: signoffs ?? [], targets: targets ?? [] };
}

export function buildSummaries(markers: PassportMarker[], results: PassportResult[], targets: PassportTarget[] = []): DomainSummary[] {
  const markerByKey = new Map(markers.map((m) => [m.marker_key, m]));
  const targetByKey = new Map(targets.map((t) => [t.marker_key, t]));
  const resultsByMarker = new Map<string, PassportResult[]>();
  for (const r of results) {
    const list = resultsByMarker.get(r.marker_key) ?? [];
    list.push(r);
    resultsByMarker.set(r.marker_key, list);
  }

  const series: MarkerSeries[] = [];
  for (const [key, list] of resultsByMarker) {
    const libraryMarker = markerByKey.get(key);
    if (!libraryMarker || list.length === 0) continue;
    const sorted = [...list].sort((a, b) => a.taken_on.localeCompare(b.taken_on));
    const latest = sorted[sorted.length - 1];
    // Judged and drawn against this client's own range from their latest
    // report, not a range from someone else's lab.
    const marker = withClientRanges(libraryMarker, latest);
    series.push({
      marker,
      results: sorted,
      latest,
      status: rangeStatus(Number(latest.value), marker),
      trend: trendFor(sorted.map((r) => Number(r.value)), marker),
      target: targetByKey.get(key) ?? null,
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
