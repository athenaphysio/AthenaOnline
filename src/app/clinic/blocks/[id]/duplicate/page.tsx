import Image from "next/image";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../../../clinic.module.css";
import BlockBuilder, {
  type EditorItem,
  type LibraryExerciseOption,
} from "../../BlockBuilder";
import type { SlotType } from "@/lib/slotTypes";
import type { SequenceType } from "@/lib/sequenceType";
import { cleanPrescriptionMode } from "@/lib/prescriptionMode";
import { getBlockUsageTagCatalog } from "@/lib/blockUsageTags";
import ClinicBrandbar from "../../../ClinicBrandbar";

type Week = {
  week_number: number;
  exercise_id: string;
  rationale: string | null;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
  prescription_mode: string | null;
  exercises: { name_clinical: string };
};

type Item = {
  id: string;
  item_order: number;
  block_item_weeks: Week[];
};

type BlockNotes = {
  condition_use_case: string | null;
  contraindication_flags: string | null;
};

type Block = {
  id: string;
  name: string;
  type: string;
  block_length_weeks: number;
  phase_id: string | null;
  sequence_type: SequenceType;
  designations: string[] | null;
  block_notes: BlockNotes | BlockNotes[] | null;
  block_items: Item[];
};

export default async function DuplicateBlockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ data: block }, { data: library }, { data: phaseTags }, usageTagCatalog, { data: usageTagLinks }] = await Promise.all([
    supabaseAdmin
      .from("blocks")
      .select(
        "id, name, type, block_length_weeks, phase_id, sequence_type, designations, block_notes(condition_use_case, contraindication_flags), block_items(id, item_order, block_item_weeks(week_number, exercise_id, rationale, sets, reps, hold_seconds, percent_max, frequency, prescription_mode, exercises(name_clinical)))"
      )
      .eq("id", id)
      .maybeSingle<Block>(),
    supabaseAdmin
      .from("exercises")
      .select("exercise_id, name_clinical, body_site, thumbnail_url, default_prescription_mode")
      .eq("active", true)
      .order("exercise_id"),
    supabaseAdmin.from("phase_tags").select("id, name").order("name"),
    getBlockUsageTagCatalog(),
    supabaseAdmin.from("block_usage_tag_links").select("tag_id").eq("block_id", id).returns<{ tag_id: string }[]>(),
  ]);

  if (!block) {
    notFound();
  }

  const sortedItems = [...block.block_items].sort((a, b) => a.item_order - b.item_order);

  const initialItems: EditorItem[] = sortedItems.map((item, i) => ({
    key: `item-${i}`,
    weeks: [...item.block_item_weeks]
      .sort((a, b) => a.week_number - b.week_number)
      .map((w) => ({
        week_number: w.week_number,
        exercise_id: w.exercise_id,
        name: w.exercises.name_clinical,
        rationale: w.rationale ?? "",
        sets: w.sets,
        reps: w.reps,
        hold_seconds: w.hold_seconds,
        percent_max: w.percent_max,
        frequency: w.frequency,
        prescription_mode: cleanPrescriptionMode(w.prescription_mode),
      })),
  }));

  const notes = Array.isArray(block.block_notes) ? block.block_notes[0] : block.block_notes;
  const newBlockId = crypto.randomUUID();

  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>Duplicate block</h1>
        <p className={styles.subheading}>Copied from &ldquo;{block.name}&rdquo;. Rename it and adjust as needed.</p>

        <BlockBuilder
          mode="create"
          blockId={newBlockId}
          initialName={`${block.name} (copy)`}
          initialType={block.type as SlotType}
          initialBlockLengthWeeks={block.block_length_weeks}
          initialItems={initialItems}
          aiDraft={null}
          exerciseLibrary={(library ?? []) as LibraryExerciseOption[]}
          phaseTags={phaseTags ?? []}
          initialPhaseId={block.phase_id}
          initialConditionUseCase={notes?.condition_use_case ?? null}
          initialContraindicationFlags={notes?.contraindication_flags ?? null}
          initialSequenceType={block.sequence_type}
          initialDesignations={block.designations ?? []}
          usageTagCatalog={usageTagCatalog}
          initialUsageTagIds={(usageTagLinks ?? []).map((l) => l.tag_id)}
        />
      </div>
    </div>
  );
}
