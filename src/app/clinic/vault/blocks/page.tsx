import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../ClinicBrandbar";
import VaultTabs from "../VaultTabs";
import BlocksLibraryClient, { type BlockCard } from "./BlocksLibraryClient";
import styles from "../VaultLibrary.module.css";

// Same reasoning as the Exercises tab -- no dynamic API of its own, so
// without this the library would freeze at whatever blocks looked like at
// build time.
export const dynamic = "force-dynamic";

type BlockRow = { id: string; name: string; type: string; block_length_weeks: number };
type BlockItemRow = { id: string; block_id: string; item_order: number };
type BlockItemWeekRow = { block_item_id: string; exercises: { name_clinical: string } | null };
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

export default async function VaultBlocksPage() {
  const [blocksRes, blockItemsRes, blockItemWeeksRes, cardioBlocksRes] = await Promise.all([
    supabaseAdmin.from("blocks").select("id, name, type, block_length_weeks").order("name").returns<BlockRow[]>(),
    supabaseAdmin.from("block_items").select("id, block_id, item_order").order("item_order").returns<BlockItemRow[]>(),
    supabaseAdmin
      .from("block_item_weeks")
      .select("block_item_id, exercises(name_clinical)")
      .eq("week_number", 1)
      .returns<BlockItemWeekRow[]>(),
    supabaseAdmin
      .from("cardio_blocks")
      .select("id, name, category, tier, modality, structure, steady_duration_seconds, interval_reps, interval_work_seconds")
      .order("name")
      .returns<CardioBlockRow[]>(),
  ]);

  for (const res of [blocksRes, blockItemsRes, blockItemWeeksRes, cardioBlocksRes]) {
    if (res.error) throw new Error(`Vault blocks library query failed: ${res.error.message}`);
  }

  const blockItems = blockItemsRes.data ?? [];
  const nameByBlockItemId = new Map((blockItemWeeksRes.data ?? []).map((w) => [w.block_item_id, w.exercises?.name_clinical ?? null]));

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
    return {
      kind: "exercise",
      id: b.id,
      name: b.name,
      type: b.type,
      weeks: b.block_length_weeks,
      exerciseCount: items.length,
      previewNames,
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
  }));

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

        <VaultTabs active="blocks" />

        <BlocksLibraryClient blocks={[...exerciseCards, ...cardioCards]} />
      </div>
    </div>
  );
}
