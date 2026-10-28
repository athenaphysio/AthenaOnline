import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// The one place that decides what a clinician may see. Every clinician
// screen and route asks here, and nowhere else, so the rule cannot drift.
//
// A clinician sees a section of a client's record only when:
//   1. the client is in a package,
//   2. the clinician has that section switched on for that package,
//   3. the client's newest consent for that package is signed against the
//      current published wording, is not withdrawn, and names this
//      clinician with this section.
// The result is the overlap of what is switched on now and what the client
// agreed to, so switching a section off works at once, and switching one on
// waits for the client to sign again.

export { SECTIONS, VIEW_SECTIONS, PASSPORT_SECTIONS, sectionLabel, type SectionKey } from "@/lib/clinicianAccessSections";
import { SECTIONS, type SectionKey } from "@/lib/clinicianAccessSections";

export type ConsentClinician = { staff_id: string; name: string; profession: string | null; sections: string[] };

export type Package = { id: string; name: string; brand_pack_id: string | null };

// ---------------------------------------------------------------------------
// What each clinician in a package is switched on to see right now. This is
// also exactly the list a client is asked to agree to.
// ---------------------------------------------------------------------------
export async function currentCliniciansForPackage(packageId: string): Promise<ConsentClinician[]> {
  const { data: rows, error } = await supabaseAdmin
    .from("staff_package_sections")
    .select("staff_id, section, staff(name, profession, role)")
    .eq("package_id", packageId)
    .returns<{ staff_id: string; section: string; staff: { name: string; profession: string | null; role: string } | null }[]>();
  if (error) throw new Error(error.message);

  const byStaff = new Map<string, ConsentClinician>();
  for (const r of rows ?? []) {
    if (!r.staff || r.staff.role !== "coach") continue;
    const entry = byStaff.get(r.staff_id) ?? { staff_id: r.staff_id, name: r.staff.name, profession: r.staff.profession, sections: [] };
    entry.sections.push(r.section);
    byStaff.set(r.staff_id, entry);
  }
  const order = SECTIONS.map((s) => s.key as string);
  return Array.from(byStaff.values())
    .map((c) => ({ ...c, sections: c.sections.sort((a, b) => order.indexOf(a) - order.indexOf(b)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function currentConsentVersion(packageId: string) {
  const { data } = await supabaseAdmin
    .from("consent_versions")
    .select("id, version, body, published_at")
    .eq("package_id", packageId)
    .not("published_at", "is", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; version: number; body: string; published_at: string }>();
  return data ?? null;
}

export type ConsentRow = {
  id: string;
  consent_version_id: string;
  clinicians: ConsentClinician[];
  signed_at: string;
  signed_name: string;
  withdrawn_at: string | null;
};

async function latestConsent(patientId: string, packageId: string): Promise<ConsentRow | null> {
  const { data } = await supabaseAdmin
    .from("patient_consents")
    .select("id, consent_version_id, clinicians, signed_at, signed_name, withdrawn_at")
    .eq("patient_id", patientId)
    .eq("package_id", packageId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle<ConsentRow>();
  return data ?? null;
}

// ---------------------------------------------------------------------------
// Consent status for one client in one package, used by the client's own
// screens and by the clinic.
// ---------------------------------------------------------------------------
export type ConsentStatus =
  | { state: "no_wording" }
  | { state: "not_signed"; version: { id: string; version: number; body: string }; clinicians: ConsentClinician[] }
  | { state: "needs_resign"; version: { id: string; version: number; body: string }; clinicians: ConsentClinician[]; previous: ConsentRow; reason: string }
  | { state: "withdrawn"; version: { id: string; version: number; body: string }; clinicians: ConsentClinician[]; previous: ConsentRow }
  | { state: "signed"; version: { id: string; version: number; body: string }; clinicians: ConsentClinician[]; consent: ConsentRow };

export async function consentStatus(patientId: string, packageId: string): Promise<ConsentStatus> {
  const [version, clinicians, consent] = await Promise.all([
    currentConsentVersion(packageId),
    currentCliniciansForPackage(packageId),
    latestConsent(patientId, packageId),
  ]);
  return decideConsent(version, clinicians, consent);
}

// The decision itself, with no database calls, so it can be tested alone.
export function decideConsent(
  version: { id: string; version: number; body: string } | null,
  clinicians: ConsentClinician[],
  consent: ConsentRow | null
): ConsentStatus {
  if (!version) return { state: "no_wording" };
  if (!consent) return { state: "not_signed", version, clinicians };
  if (consent.withdrawn_at) return { state: "withdrawn", version, clinicians, previous: consent };
  if (consent.consent_version_id !== version.id) {
    return { state: "needs_resign", version, clinicians, previous: consent, reason: "The wording has been updated." };
  }
  // Anyone now switched on to see something the client did not agree to
  // means the client is asked again. Fewer people or sections never does.
  for (const c of clinicians) {
    const agreed = consent.clinicians.find((a) => a.staff_id === c.staff_id);
    const extra = c.sections.filter((s) => !agreed?.sections.includes(s));
    if (extra.length > 0) {
      return {
        state: "needs_resign",
        version,
        clinicians,
        previous: consent,
        reason: agreed ? `${c.name} has been given access to more of your information.` : `${c.name} has joined the care team.`,
      };
    }
  }
  return { state: "signed", version, clinicians, consent };
}

// ---------------------------------------------------------------------------
// The clinician's side: which clients, and which sections of each.
// ---------------------------------------------------------------------------
export type ConsentListRow = {
  patient_id: string;
  package_id: string;
  consent_version_id: string;
  clinicians: ConsentClinician[];
  signed_at: string;
  withdrawn_at: string | null;
};

export type ClientAccess = {
  patientId: string;
  firstName: string;
  lastName: string | null;
  packageId: string;
  packageName: string;
  brandPackId: string | null;
  sections: SectionKey[];
};

// Every client this clinician may currently see, with the sections they may
// see for each. A client in two of the clinician's packages appears once,
// with the sections from both combined.
export async function accessibleClients(staffId: string): Promise<ClientAccess[]> {
  const { data: switches, error } = await supabaseAdmin
    .from("staff_package_sections")
    .select("package_id, section, packages(id, name, brand_pack_id)")
    .eq("staff_id", staffId)
    .returns<{ package_id: string; section: string; packages: Package | null }[]>();
  if (error) throw new Error(error.message);
  if (!switches || switches.length === 0) return [];

  const sectionsByPackage = new Map<string, Set<string>>();
  const packages = new Map<string, Package>();
  for (const s of switches) {
    if (!s.packages) continue;
    packages.set(s.package_id, s.packages);
    const set = sectionsByPackage.get(s.package_id) ?? new Set<string>();
    set.add(s.section);
    sectionsByPackage.set(s.package_id, set);
  }
  const packageIds = Array.from(packages.keys());

  const [{ data: members }, { data: consents }, { data: versions }] = await Promise.all([
    supabaseAdmin
      .from("patient_packages")
      .select("patient_id, package_id, patients(first_name, last_name)")
      .in("package_id", packageIds)
      .returns<{ patient_id: string; package_id: string; patients: { first_name: string; last_name: string | null } | null }[]>(),
    supabaseAdmin
      .from("patient_consents")
      .select("patient_id, package_id, consent_version_id, clinicians, signed_at, withdrawn_at")
      .in("package_id", packageIds)
      .order("signed_at", { ascending: false })
      .returns<ConsentListRow[]>(),
    supabaseAdmin
      .from("consent_versions")
      .select("id, package_id, version")
      .in("package_id", packageIds)
      .not("published_at", "is", null)
      .returns<{ id: string; package_id: string; version: number }[]>(),
  ]);

  const currentVersion = new Map<string, { id: string; version: number }>();
  for (const v of versions ?? []) {
    const existing = currentVersion.get(v.package_id);
    if (!existing || v.version > existing.version) currentVersion.set(v.package_id, v);
  }
  // Newest consent per client per package (already sorted newest first).
  const newestConsent = new Map<string, ConsentListRow>();
  for (const c of consents ?? []) {
    const key = `${c.patient_id}:${c.package_id}`;
    if (!newestConsent.has(key)) newestConsent.set(key, c);
  }

  return computeAccess(staffId, sectionsByPackage, packages, members ?? [], newestConsent, currentVersion);
}

// The decision itself, with no database calls, so it can be tested alone.
export function computeAccess(
  staffId: string,
  sectionsByPackage: Map<string, Set<string>>,
  packages: Map<string, Package>,
  members: { patient_id: string; package_id: string; patients: { first_name: string; last_name: string | null } | null }[],
  newestConsent: Map<string, ConsentListRow>,
  currentVersion: Map<string, { id: string; version: number }>
): ClientAccess[] {
  const out = new Map<string, ClientAccess>();
  for (const m of members) {
    if (!m.patients) continue;
    if (!packages.has(m.package_id)) continue;
    const version = currentVersion.get(m.package_id);
    const consent = newestConsent.get(`${m.patient_id}:${m.package_id}`);
    if (!version || !consent || consent.withdrawn_at || consent.consent_version_id !== version.id) continue;
    const agreed = consent.clinicians.find((c) => c.staff_id === staffId);
    if (!agreed) continue;
    const switchedOn = sectionsByPackage.get(m.package_id) ?? new Set<string>();
    const allowed = agreed.sections.filter((s) => switchedOn.has(s)) as SectionKey[];
    if (allowed.length === 0) continue;

    const pkg = packages.get(m.package_id)!;
    const existing = out.get(m.patient_id);
    if (existing) {
      existing.sections = Array.from(new Set([...existing.sections, ...allowed]));
    } else {
      out.set(m.patient_id, {
        patientId: m.patient_id,
        firstName: m.patients.first_name,
        lastName: m.patients.last_name,
        packageId: m.package_id,
        packageName: pkg.name,
        brandPackId: pkg.brand_pack_id,
        sections: allowed,
      });
    }
  }
  return Array.from(out.values()).sort((a, b) =>
    `${a.firstName} ${a.lastName ?? ""}`.localeCompare(`${b.firstName} ${b.lastName ?? ""}`)
  );
}

// The single check every clinician page and route makes for one client.
// Returns null when the clinician may see nothing at all of this client.
export async function clientAccessFor(staffId: string, patientId: string): Promise<ClientAccess | null> {
  const all = await accessibleClients(staffId);
  return all.find((c) => c.patientId === patientId) ?? null;
}

export async function logAccess(staffId: string, patientId: string, sections: string[]): Promise<void> {
  if (sections.length === 0) return;
  const { error } = await supabaseAdmin
    .from("staff_access_log")
    .insert(sections.map((section) => ({ staff_id: staffId, patient_id: patientId, section })));
  if (error) console.error("access log write failed", error.message);
}

// A short fingerprint of exactly what a client is being asked to agree to,
// so a sign request is refused if the wording or the team changed between
// the client opening the page and pressing sign.
export function consentFingerprint(versionId: string, clinicians: ConsentClinician[]): string {
  return JSON.stringify([versionId, clinicians.map((c) => [c.staff_id, c.profession ?? "", [...c.sections].sort()])]);
}

// Every package this client is in that has published consent wording, with
// where the client stands on it.
export async function clientConsentOverview(patientId: string) {
  const { data } = await supabaseAdmin
    .from("patient_packages")
    .select("package_id, packages(name)")
    .eq("patient_id", patientId)
    .returns<{ package_id: string; packages: { name: string } | null }[]>();
  const out: { packageId: string; packageName: string; status: ConsentStatus }[] = [];
  for (const m of data ?? []) {
    const status = await consentStatus(patientId, m.package_id);
    if (status.state === "no_wording") continue;
    out.push({ packageId: m.package_id, packageName: m.packages?.name ?? "Your programme", status });
  }
  return out;
}
