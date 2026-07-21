import Image from "next/image";
import { supabase } from "@/lib/supabase";
import styles from "../clinic.module.css";
import ProgrammeAudioList, { type ProgrammeRow } from "./ProgrammeAudioList";

export default async function ProgrammesAudioPage() {
  const { data } = await supabase
    .from("programmes")
    .select("id, patient_first_name, title, share_code, audio_url")
    .order("created_at", { ascending: false })
    .returns<ProgrammeRow[]>();

  const programmes = data ?? [];

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <div className={styles.brandbar}>
          <Image src="/icons/athena-mark.png" alt="" width={26} height={26} />
          <div className={styles.brandname}>Athena Physio — Clinic</div>
        </div>

        <h1 className={styles.heading}>Programme messages</h1>
        <p className={styles.subheading}>
          A short personal &ldquo;word from David&rdquo; per programme — the first thing the
          patient hears when they open their session.
        </p>

        <ProgrammeAudioList programmes={programmes} />
      </div>
    </div>
  );
}
