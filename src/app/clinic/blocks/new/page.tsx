import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../../clinic.module.css";
import BlockBuilder, { type LibraryExerciseOption } from "../BlockBuilder";
import ClinicBrandbar from "../../ClinicBrandbar";
import { SLOT_TYPES, type SlotType } from "@/lib/slotTypes";

// Without this, Next.js prerenders this page once at build time, baking the
// crypto.randomUUID() below into static HTML -- every visitor gets the same
// blockId until the next deploy, and every save after the first collides on
// the primary key. Must stay dynamic so each visit gets a fresh id.
export const dynamic = "force-dynamic";

const VALID_TYPES = new Set(SLOT_TYPES.map((t) => t.value));

export default async function NewBlockPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const initialType: SlotType = type && VALID_TYPES.has(type as SlotType) ? (type as SlotType) : "warm_up";

  const [{ data: library }, { data: phaseTags }] = await Promise.all([
    supabaseAdmin
      .from("exercises")
      .select("exercise_id, name_clinical, body_site, thumbnail_url, default_prescription_mode")
      .eq("active", true)
      .order("exercise_id"),
    supabaseAdmin.from("phase_tags").select("id, name").order("name"),
  ]);

  const blockId = crypto.randomUUID();

  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>New block</h1>
        <p className={styles.subheading}>
          Build a reusable group of exercises once, then use it inside any Workout.
        </p>

        <BlockBuilder
          mode="create"
          blockId={blockId}
          initialName=""
          initialType={initialType}
          initialBlockLengthWeeks={4}
          initialItems={[]}
          aiDraft={null}
          exerciseLibrary={(library ?? []) as LibraryExerciseOption[]}
          phaseTags={phaseTags ?? []}
        />
      </div>
    </div>
  );
}
