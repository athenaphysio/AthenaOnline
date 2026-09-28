import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../../ClinicBrandbar";
import VaultTabs from "../../VaultTabs";
import styles from "../../VaultLibrary.module.css";
import LadderEditorClient, { type LadderDetail, type RungDetail } from "./LadderEditorClient";

export const dynamic = "force-dynamic";

type LadderRow = {
  id: string;
  name: string;
  phase_label: string | null;
  description: string | null;
  active: boolean;
};

type RungRow = {
  id: string;
  rung_number: number;
  repeats: number | null;
  run_portion: string | null;
  recovery: string | null;
  target_pace: string | null;
  effort_cue: string | null;
  total_running_minutes: string | null;
  notes: string | null;
};

export default async function RunningLadderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [ladderRes, rungsRes] = await Promise.all([
    supabaseAdmin
      .from("running_ladders")
      .select("id, name, phase_label, description, active")
      .eq("id", id)
      .maybeSingle<LadderRow>(),
    supabaseAdmin
      .from("running_rungs")
      .select("id, rung_number, repeats, run_portion, recovery, target_pace, effort_cue, total_running_minutes, notes")
      .eq("ladder_id", id)
      .order("rung_number")
      .returns<RungRow[]>(),
  ]);

  if (ladderRes.error) throw new Error(`Running ladder query failed: ${ladderRes.error.message}`);
  if (rungsRes.error) throw new Error(`Running rungs query failed: ${rungsRes.error.message}`);
  if (!ladderRes.data) notFound();

  const ladder: LadderDetail = ladderRes.data;
  const rungs: RungDetail[] = (rungsRes.data ?? []).map((r) => ({ ...r, key: r.id }));

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
          <LadderEditorClient ladder={ladder} initialRungs={rungs} />
        </div>
      </div>
    </div>
  );
}
