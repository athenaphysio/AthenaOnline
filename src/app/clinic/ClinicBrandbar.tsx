"use client";

import { useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useClinicBrand } from "./ClinicBrandContext";
import Image from "next/image";
import { useDirtyState } from "./DirtyStateContext";
import styles from "./clinic.module.css";
import { brandedSidebar } from "./ClinicSidebar";

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
  accent = null,
  canvas = null,
}: {
  label?: string;
  logoUrl?: string | null;
  wordmarkUrl?: string | null;
  /** The client's accent and canvas, known on the server. When given, the
   * sidebar is branded from the first frame of the page rather than once
   * the page's scripts start, so it never flashes Athena in between. */
  accent?: string | null;
  canvas?: string | null;
}) {
  const router = useRouter();
  const { isDirty } = useDirtyState();
  const { setBrand } = useClinicBrand();
  const ref = useRef<HTMLButtonElement>(null);
  const branded = Boolean(logoUrl || wordmarkUrl);

  // A branded page tells the sidebar which brand to wear, before the screen
  // is drawn so the sidebar never shows Athena for a moment first. The
  // colours are read from the page, where the client's pack has set them.
  useLayoutEffect(() => {
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

  const firstFrame = branded && accent && canvas ? sidebarSheet(accent, canvas, logoUrl) : null;

  return (
    <>
    {firstFrame && <style dangerouslySetInnerHTML={{ __html: firstFrame }} />}
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
    </>
  );
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const SAFE_URL = /^(https:\/\/|\/)[A-Za-z0-9._~:/?#@!$&+,;=%-]+$/;

// The sidebar's branded look as a stylesheet, from values the server
// already knows. Only plain hex colours and plain image addresses are
// written, so nothing else can reach the page this way.
function sidebarSheet(accent: string, canvas: string, logoUrl: string | null): string | null {
  if (!HEX.test(accent) || !HEX.test(canvas)) return null;
  const vars = Object.entries(brandedSidebar(accent, canvas) as Record<string, string>)
    .map(([k, v]) => `${k === "color" ? "color" : k}:${v}`)
    .join(";");
  const logo = logoUrl && SAFE_URL.test(logoUrl) ? logoUrl : null;
  return [
    `[data-clinic-sidebar]{${vars}}`,
    logo ? `[data-clinic-sidebar] [data-sidebar-athena]{display:none}` : "",
    logo
      ? `[data-clinic-sidebar] [data-sidebar-prelogo]{display:block!important;width:120px;height:40px;background:url("${logo}") center/contain no-repeat}`
      : "",
  ].join("");
}
