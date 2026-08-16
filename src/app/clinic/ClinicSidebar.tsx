"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useDirtyState } from "./DirtyStateContext";
import { CLINIC_NAV_PRIMARY, CLINIC_NAV_SECONDARY, activeNavHref, newHrefForPathname, type ClinicNavItem } from "@/lib/clinicNav";
import { categoryMeta } from "@/lib/blockCategory";
import styles from "./clinic.module.css";

// Every row is a button, not a plain <Link> -- same unsaved-changes gate as
// ClinicBrandbar's Home control, so leaving a half-finished builder via the
// sidebar prompts exactly the same confirmation leaving it any other way
// already does.
function NavRow({ item, active, onNavigate }: { item: ClinicNavItem; active: boolean; onNavigate: (href: string) => void }) {
  const meta = categoryMeta(item.category);
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.href)}
      className={`${styles.sidebarRow} ${active ? styles.sidebarRowActive : ""}`}
    >
      {meta ? (
        <span className={styles.sidebarDot} style={{ background: meta.accent }} aria-hidden />
      ) : (
        <span className={styles.sidebarDotSpacer} aria-hidden />
      )}
      <span className={styles.sidebarRowLabel}>{item.label}</span>
    </button>
  );
}

export default function ClinicSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isDirty } = useDirtyState();
  const active = activeNavHref(pathname);
  const newHref = newHrefForPathname(pathname);

  function navigate(href: string) {
    if (href === pathname) return;
    if (isDirty && !window.confirm("You have unsaved changes on this page. Leave anyway and lose them?")) {
      return;
    }
    router.push(href);
  }

  return (
    <div className={styles.sidebar}>
      <button type="button" onClick={() => navigate("/clinic")} className={styles.sidebarBrand} aria-label="Home">
        <Image src="/icons/athena-mark.png" alt="" width={22} height={22} />
      </button>

      <div className={styles.sidebarSection}>
        {CLINIC_NAV_PRIMARY.map((item) => (
          <NavRow key={item.href} item={item} active={item.href === active} onNavigate={navigate} />
        ))}
      </div>

      <div className={styles.sidebarDivider} />

      <div className={styles.sidebarSection}>
        {CLINIC_NAV_SECONDARY.map((item) => (
          <NavRow key={item.href} item={item} active={item.href === active} onNavigate={navigate} />
        ))}
      </div>

      {newHref && (
        <button type="button" className={styles.sidebarNewButton} onClick={() => navigate(newHref)}>
          + New
        </button>
      )}
    </div>
  );
}
