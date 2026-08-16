import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";

// Every tile here is Denim (the Content zone) except Forms -- Submissions is
// its own named zone (Heather), and that colour has to match wherever Forms
// shows up next: this tile, the Forms list/builder pages, and the
// Submissions tab on a patient's record.
const TILES = [
  {
    href: "/clinic/exercises",
    title: "Exercises",
    description: "The base library — every exercise referenced everywhere else in the app.",
    accent: "var(--accent-content)",
    accentSoft: "var(--accent-content-soft)",
  },
  {
    href: "/clinic/blocks",
    title: "Blocks",
    description: "Reusable, typed groups of exercises with their own week-to-week progression.",
    accent: "var(--accent-content)",
    accentSoft: "var(--accent-content-soft)",
  },
  {
    href: "/clinic/blocks/activation",
    title: "Activations",
    description: "Activation blocks on their own, separated out since they always come first in a workout.",
    accent: "var(--accent-content)",
    accentSoft: "var(--accent-content-soft)",
  },
  {
    href: "/clinic/blocks/injury-prevention",
    title: "Injury Preventions",
    description: "Injury prevention blocks on their own, separated out since they always come first in a workout.",
    accent: "var(--accent-content)",
    accentSoft: "var(--accent-content-soft)",
  },
  {
    href: "/clinic/workouts",
    title: "Workouts",
    description: "One full session, built from Blocks plus any standalone exercises.",
    accent: "var(--accent-content)",
    accentSoft: "var(--accent-content-soft)",
  },
  {
    href: "/clinic/programmes",
    title: "Programmes",
    description: "Every programme ever built, scheduled or open, across every patient.",
    accent: "var(--accent-content)",
    accentSoft: "var(--accent-content-soft)",
  },
  {
    href: "/clinic/programme-templates",
    title: "Programme Templates",
    description: "Reusable, patient-agnostic schedules — a starting point for Quick Build.",
    accent: "var(--accent-content)",
    accentSoft: "var(--accent-content-soft)",
  },
  {
    href: "/clinic/forms",
    title: "Forms",
    description: "Intake, check-ins, consent — build once, send to a patient or a group.",
    accent: "var(--accent-forms)",
    accentSoft: "var(--accent-forms-soft)",
  },
  {
    href: "/clinic/vault/equipment",
    title: "Equipment",
    description: "Add, rename, or remove equipment items and their icons, used to tag exercises.",
    accent: "var(--accent-content)",
    accentSoft: "var(--accent-content-soft)",
  },
  {
    href: "/clinic/vault/phase-tags",
    title: "Programme phases",
    description: "Add, rename, or remove phase tags, used to mark which stage an exercise or block belongs to.",
    accent: "var(--accent-content)",
    accentSoft: "var(--accent-content-soft)",
  },
  {
    href: "/clinic/content/email-templates",
    title: "Email templates",
    description: "Every automated email, subject and body, with its own approve-before-sending status.",
    accent: "var(--accent-content)",
    accentSoft: "var(--accent-content-soft)",
  },
];

type TileStyle = CSSProperties & { "--tile-accent"?: string; "--tile-accent-soft"?: string };

export default function ContentHubPage() {
  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Content</h1>
        <p className={styles.subheading}>
          The workshop — building reusable material, not dealing with a named patient.{" "}
          <Link href="/clinic" className={styles.canvasLink}>
            ← Patients
          </Link>
        </p>

        <div className={styles.tileGrid}>
          {TILES.map((tile) => {
            const tileStyle: TileStyle = { "--tile-accent": tile.accent, "--tile-accent-soft": tile.accentSoft };
            return (
              <Link key={tile.href} href={tile.href} className={styles.tileCard} style={tileStyle}>
                <div className={styles.tileTitle}>{tile.title}</div>
                <p className={styles.tileDescription}>{tile.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
