import Image from "next/image";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computePatientStanding, isActiveStatus } from "@/lib/patientStatus";
import styles from "./clinic.module.css";
import GroupsRail from "./GroupsRail";
import PatientListClient, { type PatientListRow } from "./PatientListClient";
import ClinicBrandbar from "./ClinicBrandbar";
import AddClientButton from "./AddClientButton";

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
  last_name: string | null;
  email: string;
  created_at: string;
  last_seen_at: string | null;
  wearable_tracking_enabled: boolean;
  invited_at: string | null;
  password_set_at: string | null;
  awaiting_approval: boolean;
  brand_pack_id: string | null;
};

type BrandPackRow = { id: string; name: string; accent_color: string; background_color: string; is_default: boolean };
type PatientPackageRow = { patient_id: string; packages: { name: string; brand_pack_id: string | null } | null };

type ProgrammeRow = {
  brand_pack_id: string | null;
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
  occurred_at: string;
};

type GroupRow = { id: string; name: string };
type GroupMemberRow = { patient_id: string; group_id: string };

type SearchParams = Promise<{ filter?: string }>;

export default async function ClinicHomePage({ searchParams }: { searchParams: SearchParams }) {
  const { filter: rawFilter } = await searchParams;
  const filter = rawFilter ?? "all";

  const [patientsRes, programmesRes, completionsRes, groupsRes, groupMembersRes, brandPacksRes, patientPackagesRes] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select("id, first_name, last_name, email, created_at, last_seen_at, wearable_tracking_enabled, invited_at, password_set_at, awaiting_approval, brand_pack_id")
      .returns<PatientRow[]>(),
    supabaseAdmin
      .from("programmes")
      .select("id, patient_id, title, delivery_mode, block_length_weeks, start_date, created_at, brand_pack_id")
      .order("created_at", { ascending: false })
      .returns<ProgrammeRow[]>(),
    // Not filtered to status = 'completed' -- an explicit skip is a real
    // decision the patient made in the app, still genuine activity for the
    // "last seen doing something" signal, even though it isn't progress.
    supabaseAdmin.from("session_completions").select("patient_id, occurred_at").returns<CompletionRow[]>(),
    supabaseAdmin.from("patient_groups").select("id, name").order("name").returns<GroupRow[]>(),
    supabaseAdmin.from("patient_group_members").select("patient_id, group_id").returns<GroupMemberRow[]>(),
    supabaseAdmin.from("brand_packs").select("id, name, accent_color, background_color, is_default").order("name").returns<BrandPackRow[]>(),
    supabaseAdmin.from("patient_packages").select("patient_id, packages(name, brand_pack_id)").returns<PatientPackageRow[]>(),
  ]);

  // A failed query here (e.g. a stale/misconfigured service-role key) used
  // to silently fall through to an empty patient list -- data destructured
  // with the error discarded, indistinguishable from "genuinely no
  // patients yet". Throwing surfaces it as a real, loggable server error
  // instead.
  for (const res of [patientsRes, programmesRes, completionsRes, groupsRes, groupMembersRes, brandPacksRes, patientPackagesRes]) {
    if (res.error) {
      throw new Error(`Clinic dashboard query failed: ${res.error.message}`);
    }
  }

  const { data: patients } = patientsRes;
  const { data: programmes } = programmesRes;
  const { data: completions } = completionsRes;
  const { data: groups } = groupsRes;
  const { data: groupMembers } = groupMembersRes;

  // Which brand each client is in, by the same order the app itself uses:
  // their own pack, then a branded package, then their programme's pack,
  // otherwise standard Athena.
  const packsById = new Map((brandPacksRes.data ?? []).map((p) => [p.id, p]));
  const isBrand = (id: string | null | undefined) => Boolean(id && packsById.has(id) && !packsById.get(id)!.is_default);
  const packageBrandByPatient = new Map<string, string>();
  for (const pp of [...(patientPackagesRes.data ?? [])].sort((a, b) => (a.packages?.name ?? "").localeCompare(b.packages?.name ?? ""))) {
    const id = pp.packages?.brand_pack_id;
    if (isBrand(id) && !packageBrandByPatient.has(pp.patient_id)) packageBrandByPatient.set(pp.patient_id, id!);
  }
  function brandIdFor(patient: PatientRow, own: ProgrammeRow[]): string | null {
    if (isBrand(patient.brand_pack_id)) return patient.brand_pack_id;
    const fromPackage = packageBrandByPatient.get(patient.id);
    if (fromPackage) return fromPackage;
    return own.find((p) => isBrand(p.brand_pack_id))?.brand_pack_id ?? null;
  }

  const programmesByPatient = new Map<string, ProgrammeRow[]>();
  for (const p of programmes ?? []) {
    if (!programmesByPatient.has(p.patient_id)) programmesByPatient.set(p.patient_id, []);
    programmesByPatient.get(p.patient_id)!.push(p);
  }

  const lastCompletionByPatient = new Map<string, string>();
  for (const c of completions ?? []) {
    const existing = lastCompletionByPatient.get(c.patient_id);
    if (!existing || c.occurred_at > existing) lastCompletionByPatient.set(c.patient_id, c.occurred_at);
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
      brandId: brandIdFor(patient, own),
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

  const brandsWithCounts = [
    { id: "athena", name: "Athena Physio", count: rows.filter((r) => !r.brandId).length },
    ...(brandPacksRes.data ?? [])
      .filter((p) => !p.is_default)
      .map((p) => ({ id: p.id, name: p.name, count: rows.filter((r) => r.brandId === p.id).length }))
      .filter((b) => b.count > 0),
  ];

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
    if (filter === "brand:athena") return !r.brandId;
    if (filter.startsWith("brand:")) return r.brandId === filter.slice("brand:".length);
    return true;
  });

  // Every client goes to the list, so a search can find anyone whatever
  // filter is open; visibleIds says which of them the current filter shows
  // when the search box is empty.
  const visibleIds = filteredRows.map((r) => r.patient.id);

  const listRows: PatientListRow[] = rows.map((r) => ({
    id: r.patient.id,
    firstName: r.patient.first_name,
    lastName: r.patient.last_name,
    email: r.patient.email,
    whatTheyreOn: r.standing.whatTheyreOn,
    cyclePosition: r.standing.cyclePosition,
    lastActivityAt: r.lastActivityAt,
    status: r.standing.status,
    wearableTrackingEnabled: r.patient.wearable_tracking_enabled,
    createdAt: r.patient.created_at,
    brand: r.brandId && packsById.get(r.brandId)
      ? {
          id: r.brandId,
          name: packsById.get(r.brandId)!.name,
          accent: packsById.get(r.brandId)!.accent_color,
          background: packsById.get(r.brandId)!.background_color,
        }
      : null,
    accountStatus: r.patient.awaiting_approval
      ? ("awaiting" as const)
      : r.patient.invited_at && !r.patient.password_set_at
        ? ("invited" as const)
        : ("active" as const),
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
              Clients
            </h1>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
          <AddClientButton />
          <Link
            href="/clinic/programmes/new"
            className={styles.button}
            style={{
              width: "auto",
              padding: "0 24px",
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
            }}
          >
            + New
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
            brands={brandsWithCounts}
          />

          <div>
            {rows.length === 0 ? (
              <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
                No clients yet.
              </p>
            ) : (
              <PatientListClient rows={listRows} visibleIds={visibleIds} groups={(groups ?? []).map((g) => ({ id: g.id, name: g.name }))} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
