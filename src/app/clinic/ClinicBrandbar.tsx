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
// logoUrl / wordmarkUrl let a page show a client's own brand in place of
// the Athena mark, for example the client dashboard.
export default function ClinicBrandbar({
  label = "Athena Physio — Clinic",
  logoUrl = null,
  wordmarkUrl = null,
}: {
  label?: string;
  logoUrl?: string | null;
  wordmarkUrl?: string | null;
}) {
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
      {wordmarkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={wordmarkUrl} alt="" style={{ height: 30, width: "auto", maxWidth: 220, objectFit: "contain" }} />
      ) : (
        <span className={styles.brandmark}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" width={22} height={22} style={{ objectFit: "contain" }} />
          ) : (
            <Image src="/icons/athena-mark.png" alt="" width={22} height={22} />
          )}
        </span>
      )}
      <div className={styles.brandname}>{label}</div>
    </button>
  );
}
