import { supabase } from "@/lib/supabase";
import { vimeoEmbedUrl } from "@/lib/vimeo";
import styles from "./page.module.css";

type Exercise = {
  exercise_id: string;
  name_clinical: string;
  name_patient_facing: string | null;
  vimeo_url: string | null;
  cues_notes: string | null;
};

type ProgrammeItem = {
  id: string;
  item_order: number;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  frequency: string | null;
  rationale: string | null;
  exercises: Exercise;
};

type Programme = {
  patient_first_name: string;
  title: string;
  programme_items: ProgrammeItem[];
};

function formatPrescription(item: ProgrammeItem): string {
  const parts: string[] = [];
  if (item.sets) {
    let setPart = `${item.sets} set${item.sets === 1 ? "" : "s"}`;
    if (item.reps) {
      setPart += ` x ${item.reps} rep${item.reps === 1 ? "" : "s"}`;
    } else if (item.hold_seconds) {
      setPart += ` x ${item.hold_seconds}s hold`;
    }
    parts.push(setPart);
  }
  if (item.frequency) parts.push(item.frequency);
  return parts.join(" · ");
}

export default async function ProgrammePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const { data: programme } = await supabase
    .from("programmes")
    .select("patient_first_name, title, programme_items(id, item_order, sets, reps, hold_seconds, frequency, rationale, exercises(exercise_id, name_clinical, name_patient_facing, vimeo_url, cues_notes))")
    .eq("share_code", code)
    .maybeSingle<Programme>();

  if (!programme) {
    return (
      <main className={styles.page}>
        <p className={styles.notFound}>
          We couldn&apos;t find this programme. Please check the link, or contact the clinic.
        </p>
      </main>
    );
  }

  const items = [...programme.programme_items].sort((a, b) => a.item_order - b.item_order);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.greeting}>Hi {programme.patient_first_name},</p>
        <h1 className={styles.title}>{programme.title}</h1>
      </header>

      <ol className={styles.list}>
        {items.map((item) => {
          const exercise = item.exercises;
          const displayName = exercise.name_patient_facing || exercise.name_clinical;
          const embedUrl = vimeoEmbedUrl(exercise.vimeo_url);
          const prescription = formatPrescription(item);

          return (
            <li key={item.id} className={styles.card}>
              <h2 className={styles.exerciseName}>{displayName}</h2>

              {embedUrl && (
                <div className={styles.videoWrapper}>
                  <iframe
                    src={embedUrl}
                    className={styles.video}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title={displayName}
                  />
                </div>
              )}

              {prescription && <p className={styles.prescription}>{prescription}</p>}
              {item.rationale && <p className={styles.rationale}>{item.rationale}</p>}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
