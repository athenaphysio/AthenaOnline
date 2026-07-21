import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import styles from "../clinic.module.css";

type ProgrammeRow = {
  id: string;
  patient_first_name: string;
  title: string;
  share_code: string;
  block_length_weeks: number;
  created_at: string;
};

export default async function ProgrammesListPage() {
  const { data } = await supabase
    .from("programmes")
    .select("id, patient_first_name, title, share_code, block_length_weeks, created_at")
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

        <h1 className={styles.heading}>Programmes</h1>
        <p className={styles.subheading}>
          Open any programme to edit exercises, weekly prescriptions, the patient message, or
          resend the link.
        </p>

        {programmes.length === 0 && <p className={styles.notice}>No programmes yet.</p>}

        {programmes.map((p) => (
          <Link
            key={p.id}
            href={`/clinic/programmes/${p.id}`}
            className={styles.card}
            style={{ display: "block", textDecoration: "none", color: "inherit" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className={styles.cardTitle} style={{ margin: 0 }}>
                {p.patient_first_name}
                <span className={styles.exerciseId}>{p.title}</span>
              </span>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {p.block_length_weeks} week block
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
