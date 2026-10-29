import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClientRecordShell from "../ClientRecordShell";
import styles from "../dashboard/ClientDashboard.module.css";
import { consentStatus, sectionLabel, type ConsentStatus } from "@/lib/clinicianAccess";
import CareTeamPanel, { type PackageState, type NoteRow, type LogRow } from "./CareTeamPanel";

export const dynamic = "force-dynamic";

// One client's care team: which packages they are in, whether they have
// signed consent, the care team notes, and every time a clinician has
// opened their record.
export default async function CareTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: patient }, { data: packages }, { data: memberships }, { data: notes }, { data: log }] = await Promise.all([
    supabaseAdmin.from("patients").select("first_name, last_name").eq("id", id).maybeSingle<{ first_name: string; last_name: string | null }>(),
    supabaseAdmin.from("packages").select("id, name").order("name").returns<{ id: string; name: string }[]>(),
    supabaseAdmin.from("patient_packages").select("package_id").eq("patient_id", id).returns<{ package_id: string }[]>(),
    supabaseAdmin
      .from("care_notes")
      .select("id, section, author_name, body, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .returns<NoteRow[]>(),
    supabaseAdmin
      .from("staff_access_log")
      .select("section, accessed_at, staff(name)")
      .eq("patient_id", id)
      .order("accessed_at", { ascending: false })
      .limit(200)
      .returns<{ section: string; accessed_at: string; staff: { name: string } | null }[]>(),
  ]);
  if (!patient) notFound();

  const memberOf = new Set((memberships ?? []).map((m) => m.package_id));
  const states: PackageState[] = await Promise.all(
    (packages ?? []).map(async (p) => ({
      id: p.id,
      name: p.name,
      member: memberOf.has(p.id),
      consent: memberOf.has(p.id) ? describe(await consentStatus(id, p.id)) : null,
    }))
  );

  const logRows: LogRow[] = (log ?? []).map((l) => ({
    who: l.staff?.name ?? "A former clinician",
    section: sectionLabel(l.section),
    at: l.accessed_at,
  }));
  const name = [patient.first_name, patient.last_name].filter(Boolean).join(" ");

  return (
    <ClientRecordShell patientId={id} active={null}>
      <div style={{ margin: "0 0 14px" }}>
        <h2 style={{ margin: 0 }}>Care team</h2>
        <p className={styles.muted} style={{ margin: "4px 0 0", fontSize: 14, maxWidth: 760, lineHeight: 1.55 }}>
          Clinicians see {name} only through a package, only once {patient.first_name} has signed that package&apos;s consent, and only the sections the
          consent names.
        </p>
      </div>
      <CareTeamPanel patientId={id} packages={states} notes={notes ?? []} log={logRows} />
    </ClientRecordShell>
  );
}

function describe(status: ConsentStatus): PackageState["consent"] {
  switch (status.state) {
    case "no_wording":
      return { tone: "muted", text: "No consent wording published for this package yet, so no clinician can see this client." };
    case "not_signed":
      return { tone: "amber", text: "Not signed yet. The client is asked to sign when they open the app." };
    case "withdrawn":
      return { tone: "amber", text: `Consent withdrawn on ${day(status.previous.withdrawn_at!)}. No clinician can see this client.` };
    case "needs_resign":
      return { tone: "amber", text: `Waiting for the client to sign again. ${status.reason} Until then, nobody sees anything new.` };
    case "signed":
      return {
        tone: "green",
        text: `Signed by ${status.consent.signed_name} on ${day(status.consent.signed_at)}, version ${status.version.version}.`,
        clinicians: status.consent.clinicians.map((c) => `${c.name}: ${c.sections.map(sectionLabel).join(", ")}`),
      };
  }
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
