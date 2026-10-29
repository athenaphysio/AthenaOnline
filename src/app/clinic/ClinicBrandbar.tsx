"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useClinicBrand } from "./ClinicBrandContext";
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
  const { setBrand } = useClinicBrand();
  const ref = useRef<HTMLButtonElement>(null);
  const branded = Boolean(logoUrl || wordmarkUrl);

  // A branded page tells the sidebar which brand to wear. The colours are
  // read from the page itself, where the client's pack has already set them.
  useEffect(() => {
    if (!branded || !ref.current) return;
    const css = getComputedStyle(ref.current);
    const accent = css.getPropertyValue("--crimson").trim() || "#9b1c1c";
    const canvas = css.getPropertyValue("--dark-canvas").trim() || css.getPropertyValue("--cream").trim() || "#1c1c1c";
    setBrand({ logoUrl, accent, canvas });
    return () => setBrand(null);
  }, [branded, logoUrl, setBrand]);

  function handleClick() {
    if (isDirty && !window.confirm("You have unsaved changes on this page. Leave anyway and lose them?")) {
      return;
    }
    router.push("/clinic");
  }

  return (
    <button ref={ref} type="button" onClick={handleClick} className={styles.brandbar} aria-label="Home">
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
      {/* A client's own brand shows on its own, with no Athena name beside it. */}
      {!branded && <div className={styles.brandname}>{label}</div>}
    </button>
  );
}
