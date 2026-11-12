import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { domainByKey } from "@/lib/passport";
import { HUB_SECTIONS, hubFieldByKey, type HubFieldValue, type HubStatus } from "@/lib/onboardingHub";

// What the record already holds for each section: registration details,
// intake details and passport results. Shown read only beside the fields,
// so the question in the room becomes "is this still right?" rather than
// asking again.
export type RecordLine = { label: string; value: string; source: string };

export type PassportDomainLine = {
  domain: string;
  name: string;
  markers: number;
  latest: string | null;
  outside: string[];
  drafts: number;
  sources: string[];
};

export type HubImport = { id: string; source_label: string; file_name: string | null; fields_filled: number; safety_notes: string | null; created_at: string };

export type HubData = {
  values: Record<string, HubFieldValue>;
  record: Record<string, RecordLine[]>;
  passport: Record<string, PassportDomainLine[]>;
  findings: { title: string; result: string; source: string | null; taken_on: string }[];
  imports: HubImport[];
};

type PatientRow = {
  referral_source: string | null;
  referred_via: string | null;
  presenting_complaint: string | null;
  referral_goals_history: string | null;
  occupation: string | null;
  date_of_birth: string | null;
  gp_name: string | null;
  gp_practice: string | null;
  red_flags: string | null;
  body_region: string | null;
  date_of_onset: string | null;
  mechanism_of_injury: string | null;
  baseline_pain_score: number | null;
  sport: string | null;
  mobile_phone: string | null;
  email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  privacy_policy_accepted_at: string | null;
  treatment_consent_signed_at: string | null;
  notes_policy_accepted_at: string | null;
  password_set_at: string | null;
  invited_at: string | null;
};

function ukDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function ageFrom(dob: string | null): string {
  if (!dob) return "";
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age -= 1;
  return String(age);
}

function buildRecord(p: PatientRow | null): Record<string, RecordLine[]> {
  const out: Record<string, RecordLine[]> = {};
  if (!p) return out;
  const add = (section: string, label: string, value: string | number | null | undefined, source: string) => {
    const v = value === null || value === undefined ? "" : String(value).trim();
    if (!v) return;
    (out[section] ??= []).push({ label, value: v, source });
  };
  add("opening", "Referral source", p.referral_source, "Registration");
  add("opening", "Referred via", p.referred_via, "Intake");
  add("opening", "Reason given at intake", p.presenting_complaint, "Intake");
  add("opening", "Privacy notice accepted", ukDate(p.privacy_policy_accepted_at), "Registration");
  add("opening", "Consent to notes being kept", p.notes_policy_accepted_at ? ukDate(p.notes_policy_accepted_at) : "", "Registration");
  add("opening", "Treatment consent signed", ukDate(p.treatment_consent_signed_at), "Registration");
  add("person", "Occupation", p.occupation, "Registration");
  add("person", "Age", ageFrom(p.date_of_birth), "Registration");
  add("goals", "Goals and history at intake", p.referral_goals_history, "Intake");
  add("health", "GP", [p.gp_name, p.gp_practice].filter(Boolean).join(", "), "Registration");
  add("health", "Red flags noted", p.red_flags, "Intake");
  add("body", "Presenting complaint", p.presenting_complaint, "Intake");
  add("body", "Body region", p.body_region, "Intake");
  add("body", "Onset", p.date_of_onset, "Intake");
  add("body", "Mechanism", p.mechanism_of_injury, "Intake");
  add("body", "Baseline pain score", p.baseline_pain_score, "Intake");
  add("movement", "Sport", p.sport, "Registration");
  add("contact", "Mobile", p.mobile_phone, "Registration");
  add("contact", "Email", p.email, "Registration");
  add("contact", "Emergency contact", [p.emergency_contact_name, p.emergency_contact_phone].filter(Boolean).join(", "), "Registration");
  add(
    "contact",
    "App account",
    p.password_set_at ? `Set up on ${ukDate(p.password_set_at)}` : p.invited_at ? `Invited on ${ukDate(p.invited_at)}, not yet set up` : "",
    "App",
  );
  return out;
}

export async function loadHub(patientId: string): Promise<HubData> {
  const [{ data: rows }, { data: patient }, { data: results }, { data: markers }, { data: findings }, { data: imports }] = await Promise.all([
    supabaseAdmin
      .from("onboarding_hub_fields")
      .select("field_key, value, source, status, confirmed_at, updated_at")
      .eq("patient_id", patientId)
      .returns<HubFieldValue[]>(),
    supabaseAdmin
      .from("patients")
      .select(
        "referral_source, referred_via, presenting_complaint, referral_goals_history, occupation, date_of_birth, gp_name, gp_practice, red_flags, body_region, date_of_onset, mechanism_of_injury, baseline_pain_score, sport, mobile_phone, email, emergency_contact_name, emergency_contact_phone, privacy_policy_accepted_at, treatment_consent_signed_at, notes_policy_accepted_at, password_set_at, invited_at",
      )
      .eq("id", patientId)
      .maybeSingle<PatientRow>(),
    supabaseAdmin
      .from("passport_results")
      .select("marker_key, value, taken_on, source, status, range_low, range_high")
      .eq("patient_id", patientId)
      .order("taken_on", { ascending: true })
      .returns<
        {
          marker_key: string;
          value: number;
          taken_on: string;
          source: string | null;
          status: string;
          range_low: number | null;
          range_high: number | null;
        }[]
      >(),
    supabaseAdmin
      .from("passport_markers")
      .select("marker_key, domain, name, range_low, range_high")
      .returns<{ marker_key: string; domain: string; name: string; range_low: number | null; range_high: number | null }[]>(),
    supabaseAdmin
      .from("passport_findings")
      .select("title, result_label, source, taken_on")
      .eq("patient_id", patientId)
      .order("taken_on", { ascending: false })
      .returns<{ title: string; result_label: string; source: string | null; taken_on: string }[]>(),
    supabaseAdmin
      .from("onboarding_hub_imports")
      .select("id, source_label, file_name, fields_filled, safety_notes, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .returns<HubImport[]>(),
  ]);

  const values: Record<string, HubFieldValue> = {};
  for (const r of rows ?? []) values[r.field_key] = r;

  // The latest result for each marker, grouped by passport area.
  const markerByKey = new Map((markers ?? []).map((m) => [m.marker_key, m]));
  const latest = new Map<string, NonNullable<typeof results>[number]>();
  for (const r of results ?? []) latest.set(r.marker_key, r);
  const byDomain = new Map<string, PassportDomainLine>();
  for (const r of latest.values()) {
    const m = markerByKey.get(r.marker_key);
    if (!m) continue;
    const line =
      byDomain.get(m.domain) ??
      ({ domain: m.domain, name: domainByKey(m.domain)?.name ?? m.domain, markers: 0, latest: null, outside: [], drafts: 0, sources: [] } as PassportDomainLine);
    line.markers += 1;
    if (!line.latest || r.taken_on > line.latest) line.latest = r.taken_on;
    if (r.status === "draft") line.drafts += 1;
    const low = r.range_low ?? m.range_low;
    const high = r.range_high ?? m.range_high;
    if ((low !== null && r.value < low) || (high !== null && r.value > high)) line.outside.push(m.name);
    if (r.source && !line.sources.includes(r.source)) line.sources.push(r.source);
    byDomain.set(m.domain, line);
  }
  const passport: Record<string, PassportDomainLine[]> = {};
  for (const s of HUB_SECTIONS) {
    const lines = (s.passportDomains ?? []).map((d) => byDomain.get(d)).filter((l): l is PassportDomainLine => Boolean(l));
    if (lines.length) passport[s.key] = lines;
  }

  return {
    values,
    record: buildRecord(patient ?? null),
    passport,
    findings: (findings ?? []).map((f) => ({ title: f.title, result: f.result_label, source: f.source, taken_on: f.taken_on })),
    imports: imports ?? [],
  };
}

// Save one field as Dr David Silver PhD has written or confirmed it. An
// empty value clears the field, which returns it to "to explore".
export async function saveHubField(params: {
  patientId: string;
  fieldKey: string;
  value: string;
  status: HubStatus;
  source?: string | null;
}): Promise<HubFieldValue | null> {
  if (!hubFieldByKey(params.fieldKey)) throw new Error("Unknown field.");
  const value = params.value.trim();
  if (!value) {
    await supabaseAdmin.from("onboarding_hub_fields").delete().eq("patient_id", params.patientId).eq("field_key", params.fieldKey);
    return null;
  }
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("onboarding_hub_fields")
    .upsert(
      {
        patient_id: params.patientId,
        field_key: params.fieldKey,
        value,
        source: params.source ?? null,
        status: params.status,
        confirmed_at: params.status === "confirmed" ? now : null,
        updated_at: now,
      },
      { onConflict: "patient_id,field_key" },
    )
    .select("field_key, value, source, status, confirmed_at, updated_at")
    .single<HubFieldValue>();
  if (error) throw new Error(error.message);
  return data;
}

// Put what was read from a document into the hub. Everything arrives as
// "to confirm". A confirmed field is never overwritten; a field still
// waiting to be confirmed gains the new source's wording beneath its own,
// so nothing is lost between two documents that disagree.
export async function applyHubImport(params: {
  patientId: string;
  sourceLabel: string;
  fileName: string | null;
  documentId: string | null;
  safetyNotes: string;
  extracted: Record<string, string>;
}): Promise<number> {
  const { data: existing } = await supabaseAdmin
    .from("onboarding_hub_fields")
    .select("field_key, value, source, status")
    .eq("patient_id", params.patientId)
    .returns<{ field_key: string; value: string; source: string | null; status: HubStatus }[]>();
  const current = new Map((existing ?? []).map((r) => [r.field_key, r]));
  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  for (const [key, raw] of Object.entries(params.extracted)) {
    const value = (raw ?? "").trim();
    if (!value || !hubFieldByKey(key)) continue;
    const prior = current.get(key);
    if (prior?.status === "confirmed") continue;
    if (prior && prior.value.includes(value)) continue;
    rows.push({
      patient_id: params.patientId,
      field_key: key,
      value: prior ? `${prior.value}\n\nFrom ${params.sourceLabel}: ${value}` : value,
      source: prior?.source ? `${prior.source}; ${params.sourceLabel}` : params.sourceLabel,
      status: "to_confirm",
      confirmed_at: null,
      updated_at: now,
    });
  }
  if (rows.length) {
    const { error } = await supabaseAdmin.from("onboarding_hub_fields").upsert(rows, { onConflict: "patient_id,field_key" });
    if (error) throw new Error(error.message);
  }
  await supabaseAdmin.from("onboarding_hub_imports").insert({
    patient_id: params.patientId,
    source_label: params.sourceLabel,
    file_name: params.fileName,
    document_id: params.documentId,
    fields_filled: rows.length,
    safety_notes: params.safetyNotes || null,
  });
  return rows.length;
}
