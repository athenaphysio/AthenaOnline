import Image from "next/image";
import Link from "next/link";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";

const TILES = [
  {
    href: "/clinic/qr",
    title: "Patient sign-up QR code",
    description: "Show this on your phone, or print it for the clinic.",
  },
  {
    href: "/clinic/staff",
    title: "Staff",
    description: "Create Coach accounts and choose which Programme Templates each one can see.",
  },
  {
    href: "/clinic/purchases",
    title: "Purchases",
    description: "What was bought, by whom, when, and for how much, across every patient.",
  },
];

export default function ToolsHubPage() {
  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Tools</h1>
        <p className={styles.subheading}>
          <Link href="/clinic" className={styles.canvasLink}>
            ← Patients
          </Link>
        </p>

        <div className={styles.tileGrid}>
          {TILES.map((tile) => (
            <Link key={tile.href} href={tile.href} className={styles.tileCard}>
              <div className={styles.tileTitle}>{tile.title}</div>
              <p className={styles.tileDescription}>{tile.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
