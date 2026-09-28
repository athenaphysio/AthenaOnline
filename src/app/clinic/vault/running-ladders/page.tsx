import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../ClinicBrandbar";
import VaultTabs from "../VaultTabs";
import styles from "../VaultLibrary.module.css";
import RunningLaddersManagerClient, { type LadderRow } from "./RunningLaddersManagerClient";

export const dynamic = "force-dynamic";

type LadderQueryRow = {
  id: string;
  name: string;
  phase_label: string | null;
  active: boolean;
  running_rungs: { id: string }[];
};

// A plain list of David's own running ladders, each a named sequence of
// rungs -- see 0085_running_ladders.sql. Ordered by creation, which is also
// the order they were briefed in (the starting ladder first, then the two
// still-empty ones waiting to be filled in), not alphabetically.
export default async function RunningLaddersPage() {
  const { data, error } = await supabaseAdmin
    .from("running_ladders")
    .select("id, name, phase_label, active, running_rungs(id)")
    .order("created_at")
    .returns<LadderQueryRow[]>();

  if (error) {
    throw new Error(`Running ladder list query failed: ${error.message}`);
  }

  const ladders: LadderRow[] = (data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    phase_label: l.phase_label,
    active: l.active,
    rungCount: l.running_rungs.length,
  }));

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <ClinicBrandbar />

        <div className={styles.topbar}>
          <div>
            <h1>Vault</h1>
            <div className={styles.sub}>Build and manage your reusable exercises, blocks, workouts, and programmes</div>
          </div>
        </div>

        <VaultTabs active="running-ladders" />

        <div className={styles.settingsPane}>
          <h3>Running ladders</h3>
          <div className={styles.sub}>
            Your own standard sequence of steps for building a client&apos;s running. A Twofold note only needs to
            say which ladder and which rung a client starts on; the app fills in the rest from here.
          </div>
          <RunningLaddersManagerClient ladders={ladders} />
        </div>
      </div>
    </div>
  );
}
