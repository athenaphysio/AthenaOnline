"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useDirtyState } from "./DirtyStateContext";
import styles from "./clinic.module.css";

// The one Home control for the whole /clinic app -- same markup, same
// position, on every page, always going back to the dashboard. It replaces
// what used to be a plain, non-interactive logo + wordmark repeated at the
// top of every page; making that existing element clickable, rather than
// adding a second bar above it, is what keeps it in exactly the place
// clinicians already look for it.
export default function ClinicBrandbar({ label = "Athena Physio — Clinic" }: { label?: string }) {
  const router = useRouter();
  const { isDirty } = useDirtyState();

  function handleClick() {
    if (isDirty && !window.confirm("You have unsaved changes on this page. Leave anyway and lose them?")) {
      return;
    }
    router.push("/clinic");
  }

  return (
    <button type="button" onClick={handleClick} className={styles.brandbar} aria-label="Home">
      <Image src="/icons/athena-mark.png" alt="" width={26} height={26} />
      <div className={styles.brandname}>{label}</div>
    </button>
  );
}
