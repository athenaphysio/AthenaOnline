import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getVimeoThumbnail } from "@/lib/vimeo";
import ClinicBrandbar from "../ClinicBrandbar";
import VaultExercisesClient, { type ExerciseCard, type BodyPart } from "./VaultExercisesClient";
import VaultTabs from "./VaultTabs";
import styles from "./VaultLibrary.module.css";

// Same reasoning as the other dashboards built this session -- no dynamic
// API of its own, so without this the library would freeze at whatever the
// exercise table looked like at build time.
export const dynamic = "force-dynamic";

type ExerciseRow = {
  exercise_id: string;
  name_clinical: string;
  default_category: string | null;
  default_dosage_text: string | null;
  cues_notes: string | null;
  vimeo_url: string | null;
  thumbnail_url: string | null;
};

type BodyPartRow = { id: string; name: string; type: "joint" | "muscle" };
type ExerciseBodyPartRow = { exercise_id: string; body_part_id: string };

function computeNextExerciseId(rows: ExerciseRow[]): string {
  let max = 0;
  for (const row of rows) {
    const match = /^EX-(\d+)$/.exec(row.exercise_id);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  const next = max + 1;
  const digits = Math.max(3, String(next).length);
  return `EX-${String(next).padStart(digits, "0")}`;
}

export default async function VaultPage() {
  const [exercisesRes, bodyPartsRes, exerciseBodyPartsRes] = await Promise.all([
    supabaseAdmin
      .from("exercises")
      .select("exercise_id, name_clinical, default_category, default_dosage_text, cues_notes, vimeo_url, thumbnail_url")
      .order("exercise_id")
      .returns<ExerciseRow[]>(),
    supabaseAdmin.from("body_parts").select("id, name, type").order("name").returns<BodyPartRow[]>(),
    supabaseAdmin.from("exercise_body_parts").select("exercise_id, body_part_id").returns<ExerciseBodyPartRow[]>(),
  ]);

  for (const res of [exercisesRes, bodyPartsRes, exerciseBodyPartsRes]) {
    if (res.error) throw new Error(`Vault exercise library query failed: ${res.error.message}`);
  }

  const rows = exercisesRes.data ?? [];
  const bodyParts = bodyPartsRes.data ?? [];
  const bodyPartsById = new Map(bodyParts.map((bp) => [bp.id, bp]));

  const bodyPartIdsByExercise = new Map<string, string[]>();
  for (const link of exerciseBodyPartsRes.data ?? []) {
    if (!bodyPartIdsByExercise.has(link.exercise_id)) bodyPartIdsByExercise.set(link.exercise_id, []);
    bodyPartIdsByExercise.get(link.exercise_id)!.push(link.body_part_id);
  }

  // Thumbnails are looked up live from Vimeo's oEmbed API and cached for a
  // day at the fetch layer, so this only hits Vimeo for real on the first
  // load after each cache window. A stored thumbnail_url (from a manual
  // cover upload, used when a video is private or the link is bad) always
  // wins over the live lookup.
  const liveThumbnails = await Promise.all(rows.map((r) => (r.thumbnail_url ? null : getVimeoThumbnail(r.vimeo_url))));

  const cards: ExerciseCard[] = rows.map((r, i) => ({
    id: r.exercise_id,
    name: r.name_clinical,
    category: r.default_category,
    dosageText: r.default_dosage_text,
    cuesNotes: r.cues_notes,
    vimeoUrl: r.vimeo_url,
    thumbnailUrl: r.thumbnail_url ?? liveThumbnails[i],
    needsVideo: !r.vimeo_url,
    bodyPartIds: bodyPartIdsByExercise.get(r.exercise_id) ?? [],
    bodyParts: (bodyPartIdsByExercise.get(r.exercise_id) ?? [])
      .map((id) => bodyPartsById.get(id))
      .filter((bp): bp is BodyPart => bp != null),
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
          <Link href="/clinic/vault/equipment" className={styles.sub} style={{ textDecoration: "underline" }}>
            Manage equipment icons
          </Link>
        </div>

        <VaultTabs active="exercises" />

        <VaultExercisesClient exercises={cards} nextExerciseId={computeNextExerciseId(rows)} allBodyParts={bodyParts} />
      </div>
    </div>
  );
}
