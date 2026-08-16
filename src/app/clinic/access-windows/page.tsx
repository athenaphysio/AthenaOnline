import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPatientMembership, isActiveMembership } from "@/lib/membership";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";
import ExtendAccessButtons from "./ExtendAccessButtons";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

type ProgrammeRow = {
  id: string;
  patient_id: string;
  title: string;
  start_date: string;
  access_window_weeks: number;
  patients: { first_name: string; last_name: string | null; email: string } | null;
};

type Row = { programme: ProgrammeRow; closureDate: Date; daysToClosure: number };

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function patientName(p: ProgrammeRow["patients"]): string {
  if (!p) return "Unknown client";
  return p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name;
}

// Phase 6 of the access-window brief -- scoped to non-member patients
// only, on purpose. Members are David's own, personally-managed group
// already visible everywhere else in the clinic tools; this list exists
// specifically for the larger group he can't track by hand.
export default async function AccessWindowsPage() {
  const { data } = await supabaseAdmin
    .from("programmes")
    .select("id, patient_id, title, start_date, access_window_weeks, patients(first_name, last_name, email)")
    .not("access_window_weeks", "is", null)
    .is("access_paused_at", null)
    .returns<ProgrammeRow[]>();

  const now = new Date();
  const closingSoon: Row[] = [];
  const recentlyClosed: Row[] = [];

  for (const programme of data ?? []) {
    const membership = await getPatientMembership(programme.patient_id);
    if (isActiveMembership(membership)) continue;

    const closureDate = new Date(new Date(programme.start_date).getTime() + programme.access_window_weeks * 7 * DAY_MS);
    const daysToClosure = Math.floor((closureDate.getTime() - now.getTime()) / DAY_MS);
    const row: Row = { programme, closureDate, daysToClosure };

    if (daysToClosure >= 0 && daysToClosure <= 7) closingSoon.push(row);
    else if (daysToClosure < 0) recentlyClosed.push(row);
  }

  closingSoon.sort((a, b) => a.daysToClosure - b.daysToClosure);
  recentlyClosed.sort((a, b) => b.daysToClosure - a.daysToClosure);

  function RowCard({ row }: { row: Row }) {
    const { programme, closureDate, daysToClosure } = row;
    return (
      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <Link href={`/clinic/patients/${programme.patient_id}`} style={{ fontWeight: 500, fontSize: 15, color: "var(--crimson)" }}>
              {patientName(programme.patients)}
            </Link>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
              {programme.title} &middot;{" "}
              {daysToClosure >= 0
                ? `closes ${formatDate(closureDate)} (${daysToClosure === 0 ? "today" : `${daysToClosure} day${daysToClosure === 1 ? "" : "s"}`})`
                : `closed ${formatDate(closureDate)} (${Math.abs(daysToClosure)} day${Math.abs(daysToClosure) === 1 ? "" : "s"} ago)`}
            </div>
          </div>
          <ExtendAccessButtons programmeId={programme.id} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Access windows</h1>
        <p className={styles.subheading}>
          Non-member clients only, closing soon or already closed without picking a plan.{" "}
          <Link href="/clinic/tools" className={styles.canvasLink}>
            ← Tools
          </Link>
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 500, margin: "24px 0 4px" }}>Closing soon</h2>
        <p className={styles.notice} style={{ marginTop: 0, marginBottom: 12 }}>
          In the next 7 days.
        </p>
        {closingSoon.length === 0 ? (
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            Nobody closing soon.
          </p>
        ) : (
          closingSoon.map((row) => <RowCard key={row.programme.id} row={row} />)
        )}

        <h2 style={{ fontSize: 16, fontWeight: 500, margin: "28px 0 4px" }}>Recently closed, not converted</h2>
        <p className={styles.notice} style={{ marginTop: 0, marginBottom: 12 }}>
          Sorted most recently closed first.
        </p>
        {recentlyClosed.length === 0 ? (
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            Nobody in this state right now.
          </p>
        ) : (
          recentlyClosed.map((row) => <RowCard key={row.programme.id} row={row} />)
        )}
      </div>
    </div>
  );
}
