import Image from "next/image";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computePatientStanding, isActiveStatus } from "@/lib/patientStatus";
import styles from "./clinic.module.css";
import GroupsRail from "./GroupsRail";
import PatientListClient, { type PatientListRow } from "./PatientListClient";
import ClinicBrandbar from "./ClinicBrandbar";

// Without this, Next.js prerenders this page once at build time and every
// visitor gets the same frozen patient list until the next deploy -- this
// page has no dynamic API (no searchParams/cookies) to trigger dynamic
// rendering automatically, same root cause as the crypto.randomUUID()
// static-page bug fixed elsewhere in this app, just triggered by "no
// dynamic signal at all" rather than a per-request id.
export const dynamic = "force-dynamic";

type PatientRow = {
  id: string;
  first_name: string;
  email: string;
  created_at: string;
  last_seen_at: string | null;
  wearable_tracking_enabled: boolean;
};

type ProgrammeRow = {
  id: string;
  patient_id: string;
  title: string;
  delivery_mode: "scheduled" | "open";
  block_length_weeks: number;
  start_date: string;
  created_at: string;
};

type CompletionRow = {
  patient_id: string;
  completed_at: string;
};

type GroupRow = { id: string; name: string };
type GroupMemberRow = { patient_id: string; group_id: string };

type SearchParams = Promise<{ filter?: string }>;

export default async function ClinicHomePage({ searchParams }: { searchParams: SearchParams }) {
  const { filter: rawFilter } = await searchParams;
  const filter = rawFilter ?? "all";

  const [patientsRes, programmesRes, completionsRes, groupsRes, groupMembersRes] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select("id, first_name, email, created_at, last_seen_at, wearable_tracking_enabled")
      .returns<PatientRow[]>(),
    supabaseAdmin
      .from("programmes")
      .select("id, patient_id, title, delivery_mode, block_length_weeks, start_date, created_at")
      .order("created_at", { ascending: false })
      .returns<ProgrammeRow[]>(),
    supabaseAdmin.from("session_completions").select("patient_id, completed_at").returns<CompletionRow[]>(),
    supabaseAdmin.from("patient_groups").select("id, name").order("name").returns<GroupRow[]>(),
    supabaseAdmin.from("patient_group_members").select("patient_id, group_id").returns<GroupMemberRow[]>(),
  ]);

  // A failed query here (e.g. a stale/misconfigured service-role key) used
  // to silently fall through to an empty patient list -- data destructured
  // with the error discarded, indistinguishable from "genuinely no
  // patients yet". Throwing surfaces it as a real, loggable server error
  // instead.
  for (const res of [patientsRes, programmesRes, completionsRes, groupsRes, groupMembersRes]) {
    if (res.error) {
      throw new Error(`Clinic dashboard query failed: ${res.error.message}`);
    }
  }

  const { data: patients } = patientsRes;
  const { data: programmes } = programmesRes;
  const { data: completions } = completionsRes;
  const { data: groups } = groupsRes;
  const { data: groupMembers } = groupMembersRes;

  const programmesByPatient = new Map<string, ProgrammeRow[]>();
  for (const p of programmes ?? []) {
    if (!programmesByPatient.has(p.patient_id)) programmesByPatient.set(p.patient_id, []);
    programmesByPatient.get(p.patient_id)!.push(p);
  }

  const lastCompletionByPatient = new Map<string, string>();
  for (const c of completions ?? []) {
    const existing = lastCompletionByPatient.get(c.patient_id);
    if (!existing || c.completed_at > existing) lastCompletionByPatient.set(c.patient_id, c.completed_at);
  }

  const groupIdsByPatient = new Map<string, Set<string>>();
  for (const m of groupMembers ?? []) {
    if (!groupIdsByPatient.has(m.patient_id)) groupIdsByPatient.set(m.patient_id, new Set());
    groupIdsByPatient.get(m.patient_id)!.add(m.group_id);
  }

  const rows = (patients ?? []).map((patient) => {
    // Already sorted created_at desc from the query above.
    const own = programmesByPatient.get(patient.id) ?? [];
    const scheduled = own.find((p) => p.delivery_mode === "scheduled") ?? null;
    const open = own.find((p) => p.delivery_mode === "open") ?? null;
    const lastCompletion = lastCompletionByPatient.get(patient.id) ?? null;
    const lastActivityAt =
      patient.last_seen_at && lastCompletion
        ? patient.last_seen_at > lastCompletion
          ? patient.last_seen_at
          : lastCompletion
        : (patient.last_seen_at ?? lastCompletion ?? null);

    const standing = computePatientStanding({
      patientCreatedAt: patient.created_at,
      lastActivityAt,
      scheduled: scheduled
        ? { title: scheduled.title, blockLengthWeeks: scheduled.block_length_weeks, startDate: scheduled.start_date }
        : null,
      open: open ? { title: open.title, createdAt: open.created_at } : null,
    });

    return {
      patient,
      hasProgramme: own.length > 0,
      lastActivityAt,
      standing,
      groupIds: groupIdsByPatient.get(patient.id) ?? new Set<string>(),
    };
  });

  // Newest sign-ups needing action come first; once something's been built
  // for them, they settle into the list by how recently they've been active.
  rows.sort((a, b) => {
    if (a.hasProgramme !== b.hasProgramme) return a.hasProgramme ? 1 : -1;
    if (!a.hasProgramme) {
      return new Date(b.patient.created_at).getTime() - new Date(a.patient.created_at).getTime();
    }
    const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    return bTime - aTime;
  });

  const totalCount = rows.length;
  const activeCount = rows.filter((r) => isActiveStatus(r.standing.status)).length;
  const inactiveCount = totalCount - activeCount;

  const groupsWithCounts = (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    count: rows.filter((r) => r.groupIds.has(g.id)).length,
  }));

  const filteredRows = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "active") return isActiveStatus(r.standing.status);
    if (filter === "inactive") return !isActiveStatus(r.standing.status);
    if (filter.startsWith("group:")) return r.groupIds.has(filter.slice("group:".length));
    return true;
  });

  const listRows: PatientListRow[] = filteredRows.map((r) => ({
    id: r.patient.id,
    firstName: r.patient.first_name,
    email: r.patient.email,
    whatTheyreOn: r.standing.whatTheyreOn,
    cyclePosition: r.standing.cyclePosition,
    lastActivityAt: r.lastActivityAt,
    status: r.standing.status,
    wearableTrackingEnabled: r.patient.wearable_tracking_enabled,
  }));

  return (
    <div className={styles.app}>
      <div className={styles.fullWidthInner}>
        <ClinicBrandbar />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <div>
            <h1 className={styles.heading} style={{ marginBottom: 4 }}>
              Patients
            </h1>
            <Link href="/clinic/tools" style={{ color: "var(--muted)", fontSize: 13 }}>
              Tools
            </Link>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link
              href="/clinic/vault"
              className={styles.buttonSecondary}
              style={{
                width: "auto",
                padding: "0 20px",
                display: "flex",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              Vault
            </Link>
            <Link
              href="/clinic/messages"
              className={styles.buttonSecondary}
              style={{
                width: "auto",
                padding: "0 20px",
                display: "flex",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              Messages
            </Link>
            <Link
              href="/clinic/programmes/new"
              className={styles.buttonSecondary}
              style={{
                width: "auto",
                padding: "0 20px",
                display: "flex",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              + New
            </Link>
            <Link
              href="/clinic/content"
              className={styles.button}
              style={{
                width: "auto",
                padding: "0 24px",
                display: "flex",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              Content
            </Link>
          </div>
        </div>

        <div className={styles.dashboardLayout}>
          <GroupsRail
            currentFilter={filter}
            totalCount={totalCount}
            activeCount={activeCount}
            inactiveCount={inactiveCount}
            groups={groupsWithCounts}
          />

          <div>
            {rows.length === 0 ? (
              <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
                No patients yet.
              </p>
            ) : (
              <PatientListClient rows={listRows} groups={(groups ?? []).map((g) => ({ id: g.id, name: g.name }))} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
