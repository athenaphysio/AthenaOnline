import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { BlockCard } from "@/lib/vaultBlocksLibrary";
import { getExerciseEquipmentMap } from "@/lib/equipmentServer";
import { getBlockUsageTagMap } from "@/lib/blockUsageTags";
import { getBlockUsageMap } from "@/lib/blockUsage";

type BlockRow = { id: string; name: string; type: string; block_length_weeks: number };
type BlockItemRow = { id: string; block_id: string; item_order: number };
type BlockItemWeekRow = { block_item_id: string; week_number: number; exercise_id: string; exercises: { name_clinical: string } | null };
type CardioBlockRow = {
  id: string;
  name: string;
  category: string;
  tier: string | null;
  modality: string;
  structure: "steady_state" | "intervals";
  steady_duration_seconds: number | null;
  interval_reps: number | null;
  interval_work_seconds: number | null;
  interval_rest_seconds: number | null;
  review_status: "pending" | "reviewed";
};

function summarizeCardio(row: CardioBlockRow): string {
  if (row.structure === "steady_state") {
    if (row.steady_duration_seconds) return `Steady state, ${Math.round(row.steady_duration_seconds / 60)} min`;
    return "Steady state";
  }
  if (row.interval_reps && row.interval_work_seconds) {
    return `${row.interval_reps} x ${row.interval_work_seconds}s intervals`;
  }
  return "Intervals";
}

// A cardio block's own fields give a real, calculable single-sitting
// duration -- unlike an exercise block, which has no time data at all.
function cardioDurationSeconds(row: CardioBlockRow): number | null {
  if (row.structure === "steady_state") return row.steady_duration_seconds;
  if (row.interval_reps && row.interval_work_seconds) {
    return row.interval_reps * (row.interval_work_seconds + (row.interval_rest_seconds ?? 0));
  }
  return null;
}

// Shared by the Vault Blocks library (Phase 2/3) and the Vault Sessions
// builder's block picker (Phase 3), so both read the real blocks/cardio_blocks
// data the same way rather than two queries drifting apart.
export async function getVaultBlockCards(): Promise<BlockCard[]> {
  const [blocksRes, blockItemsRes, blockItemWeeksRes, cardioBlocksRes, exerciseEquipmentMap, usageTagMap, blockUsageMap] = await Promise.all([
    supabaseAdmin.from("blocks").select("id, name, type, block_length_weeks").order("name").returns<BlockRow[]>(),
    supabaseAdmin.from("block_items").select("id, block_id, item_order").order("item_order").returns<BlockItemRow[]>(),
    // Every week, not just week 1 -- the equipment roll-up needs every
    // exercise this block ever uses, since a block could in principle swap
    // exercises across weeks (see the Phase 1 audit on block_item_weeks).
    supabaseAdmin
      .from("block_item_weeks")
      .select("block_item_id, week_number, exercise_id, exercises(name_clinical)")
      .returns<BlockItemWeekRow[]>(),
    supabaseAdmin
      .from("cardio_blocks")
      .select(
        "id, name, category, tier, modality, structure, steady_duration_seconds, interval_reps, interval_work_seconds, interval_rest_seconds, review_status"
      )
      .order("name")
      .returns<CardioBlockRow[]>(),
    getExerciseEquipmentMap(),
    getBlockUsageTagMap(),
    getBlockUsageMap(),
  ]);

  for (const res of [blocksRes, blockItemsRes, blockItemWeeksRes, cardioBlocksRes]) {
    if (res.error) throw new Error(`Vault block library query failed: ${res.error.message}`);
  }

  const blockItems = blockItemsRes.data ?? [];
  const allWeeks = blockItemWeeksRes.data ?? [];
  const nameByBlockItemId = new Map(
    allWeeks.filter((w) => w.week_number === 1).map((w) => [w.block_item_id, w.exercises?.name_clinical ?? null])
  );
  const exerciseIdsByBlockItemId = new Map<string, Set<string>>();
  for (const w of allWeeks) {
    if (!exerciseIdsByBlockItemId.has(w.block_item_id)) exerciseIdsByBlockItemId.set(w.block_item_id, new Set());
    exerciseIdsByBlockItemId.get(w.block_item_id)!.add(w.exercise_id);
  }

  const itemsByBlock = new Map<string, BlockItemRow[]>();
  for (const item of blockItems) {
    if (!itemsByBlock.has(item.block_id)) itemsByBlock.set(item.block_id, []);
    itemsByBlock.get(item.block_id)!.push(item);
  }

  const exerciseCards: BlockCard[] = (blocksRes.data ?? []).map((b) => {
    const items = itemsByBlock.get(b.id) ?? [];
    const previewNames = items
      .map((item) => nameByBlockItemId.get(item.id))
      .filter((n): n is string => n != null)
      .slice(0, 3);

    const equipmentIds = new Set<string>();
    for (const item of items) {
      for (const exerciseId of exerciseIdsByBlockItemId.get(item.id) ?? []) {
        for (const equipmentId of exerciseEquipmentMap.get(exerciseId) ?? []) equipmentIds.add(equipmentId);
      }
    }

    return {
      kind: "exercise",
      id: b.id,
      name: b.name,
      type: b.type,
      weeks: b.block_length_weeks,
      exerciseCount: items.length,
      previewNames,
      durationSeconds: null,
      equipmentIds: Array.from(equipmentIds),
      usageTagIds: usageTagMap.get(b.id) ?? [],
      workoutCount: blockUsageMap.get(b.id)?.workoutCount ?? 0,
      patientNames: blockUsageMap.get(b.id)?.patientNames ?? [],
    };
  });

  const cardioCards: BlockCard[] = (cardioBlocksRes.data ?? []).map((c) => ({
    kind: "cardio",
    id: c.id,
    name: c.name,
    category: c.category,
    tier: c.tier,
    modality: c.modality,
    summary: summarizeCardio(c),
    durationSeconds: cardioDurationSeconds(c),
    equipmentIds: [],
    reviewStatus: c.review_status,
  }));

  return [...exerciseCards, ...cardioCards];
}
