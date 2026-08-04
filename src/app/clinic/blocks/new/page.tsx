import Image from "next/image";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../../clinic.module.css";
import BlockBuilder, { type LibraryExerciseOption } from "../BlockBuilder";
import ClinicBrandbar from "../../ClinicBrandbar";

// Without this, Next.js prerenders this page once at build time, baking the
// crypto.randomUUID() below into static HTML -- every visitor gets the same
// blockId until the next deploy, and every save after the first collides on
// the primary key. Must stay dynamic so each visit gets a fresh id.
export const dynamic = "force-dynamic";

export default async function NewBlockPage() {
  const { data: library } = await supabaseAdmin
    .from("exercises")
    .select("exercise_id, name_clinical, body_site, thumbnail_url")
    .eq("active", true)
    .order("exercise_id");

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
          initialType="warm_up"
          initialBlockLengthWeeks={4}
          initialItems={[]}
          aiDraft={null}
          exerciseLibrary={(library ?? []) as LibraryExerciseOption[]}
        />
      </div>
    </div>
  );
}
