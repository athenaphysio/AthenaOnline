import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../ClinicBrandbar";
import VaultTabs from "../VaultTabs";
import { getVaultBlockCards } from "@/lib/vaultBlocksLibraryServer";
import { getEquipmentCatalog, getExerciseEquipmentMap } from "@/lib/equipmentServer";
import VaultSessionsClient, { type SessionCard } from "./VaultSessionsClient";
import styles from "../VaultLibrary.module.css";

// Same reasoning as the other Vault tabs -- no dynamic API of its own, so
// without this the library would freeze at whatever sessions looked like at
// build time.
export const dynamic = "force-dynamic";

type WorkoutRow = { id: string; name: string; high_load: boolean };
type WorkoutItemRow = {
  id: string;
  workout_id: string;
  item_order: number;
  block_id: string | null;
  exercise_id: string | null;
  cardio_block_id: string | null;
  blocks: { name: string } | null;
  exercises: { name_clinical: string } | null;
  cardio_blocks: {
    name: string;
    structure: "steady_state" | "intervals";
    steady_duration_seconds: number | null;
    interval_reps: number | null;
    interval_work_seconds: number | null;
    interval_rest_seconds: number | null;
  } | null;
};

function cardioItemDurationSeconds(c: WorkoutItemRow["cardio_blocks"]): number | null {
  if (!c) return null;
  if (c.structure === "steady_state") return c.steady_duration_seconds;
  if (c.interval_reps && c.interval_work_seconds) {
    return c.interval_reps * (c.interval_work_seconds + (c.interval_rest_seconds ?? 0));
  }
  return null;
}

export default async function VaultSessionsPage() {
  const [workoutsRes, workoutItemsRes, blocks, equipmentCatalog, exerciseEquipmentMap] = await Promise.all([
    supabaseAdmin.from("workouts").select("id, name, high_load").order("name").returns<WorkoutRow[]>(),
    supabaseAdmin
      .from("workout_items")
      .select(
        "id, workout_id, item_order, block_id, exercise_id, cardio_block_id, blocks(name), exercises(name_clinical), cardio_blocks(name, structure, steady_duration_seconds, interval_reps, interval_work_seconds, interval_rest_seconds)"
      )
      .order("item_order")
      .returns<WorkoutItemRow[]>(),
    getVaultBlockCards(),
    getEquipmentCatalog(),
    getExerciseEquipmentMap(),
  ]);

  if (workoutsRes.error) throw new Error(`Vault sessions library query failed: ${workoutsRes.error.message}`);
  if (workoutItemsRes.error) throw new Error(`Vault sessions library query failed: ${workoutItemsRes.error.message}`);

  const blocksById = new Map(blocks.map((b) => [b.id, b]));

  const itemsByWorkout = new Map<string, WorkoutItemRow[]>();
  for (const item of workoutItemsRes.data ?? []) {
    if (!itemsByWorkout.has(item.workout_id)) itemsByWorkout.set(item.workout_id, []);
    itemsByWorkout.get(item.workout_id)!.push(item);
  }

  const sessions: SessionCard[] = (workoutsRes.data ?? []).map((w) => {
    const items = itemsByWorkout.get(w.id) ?? [];

    let durationSeconds: number | null = 0;
    const equipmentIds = new Set<string>();
    const itemSummaries = items.map((item) => {
      if (item.block_id) {
        durationSeconds = null;
        for (const id of blocksById.get(item.block_id)?.equipmentIds ?? []) equipmentIds.add(id);
        return { key: item.id, name: item.blocks?.name ?? "Block", kind: "block" as const };
      }
      if (item.cardio_block_id) {
        const d = cardioItemDurationSeconds(item.cardio_blocks);
        if (d == null) durationSeconds = null;
        else if (durationSeconds != null) durationSeconds += d;
        return { key: item.id, name: item.cardio_blocks?.name ?? "Cardio block", kind: "cardio" as const };
      }
      durationSeconds = null;
      if (item.exercise_id) {
        for (const id of exerciseEquipmentMap.get(item.exercise_id) ?? []) equipmentIds.add(id);
      }
      return { key: item.id, name: item.exercises?.name_clinical ?? "Exercise", kind: "exercise" as const };
    });

    return {
      id: w.id,
      name: w.name,
      highLoad: w.high_load,
      items: itemSummaries,
      durationSeconds,
      equipmentIds: Array.from(equipmentIds),
    };
  });

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <ClinicBrandbar />

        <div className={styles.topbar}>
          <div>
            <h1>Vault</h1>
            <div className={styles.sub}>Build and manage your reusable exercises, blocks, sessions, and programmes</div>
          </div>
        </div>

        <VaultTabs active="sessions" />

        <VaultSessionsClient
          sessions={sessions}
          blocks={blocks}
          equipment={equipmentCatalog}
          exerciseEquipment={Object.fromEntries(exerciseEquipmentMap)}
        />
      </div>
    </div>
  );
}
