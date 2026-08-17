"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useDirtyState } from "./DirtyStateContext";
import { useBuilderPalette } from "./BuilderPaletteContext";
import { CLINIC_NAV_PRIMARY, CLINIC_NAV_SECONDARY, activeNavHref, newHrefForPathname, type ClinicNavItem } from "@/lib/clinicNav";
import { PALETTE_BY_HREF } from "@/lib/builderPalette";
import { categoryMeta } from "@/lib/blockCategory";
import styles from "./clinic.module.css";

// Every row is a button, not a plain <Link> -- same unsaved-changes gate as
// ClinicBrandbar's Home control, so leaving a half-finished builder via the
// sidebar prompts exactly the same confirmation leaving it any other way
// already does. While a builder is open the addable rows stop navigating
// entirely (see onSelect below), so that gate never even comes up for them.
function NavRow({
  item,
  active,
  muted,
  onActivate,
}: {
  item: ClinicNavItem;
  active: boolean;
  muted?: boolean;
  onActivate: () => void;
}) {
  const meta = categoryMeta(item.category);
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-current={active ? "true" : undefined}
      className={`${styles.sidebarRow} ${active ? styles.sidebarRowActive : ""} ${muted ? styles.sidebarRowMuted : ""}`}
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
  const palette = useBuilderPalette();
  const activeHref = activeNavHref(pathname);
  const newHref = newHrefForPathname(pathname);

  function navigate(href: string) {
    if (href === pathname) return;
    if (isDirty && !window.confirm("You have unsaved changes on this page. Leave anyway and lose them?")) {
      return;
    }
    router.push(href);
  }

  // While building, an addable content type switches the library rail in
  // place instead of navigating to that type's own page. Everything else,
  // and every page that isn't a builder, navigates exactly as before.
  function activate(item: ClinicNavItem) {
    const key = PALETTE_BY_HREF[item.href];
    if (palette.active && key) {
      palette.select(key);
      return;
    }
    navigate(item.href);
  }

  // While building, the content type on offer is the only "you are here"
  // that means anything, so it is the single highlighted row. Without this
  // the route would light one up too (Workouts on the workout builder,
  // Programmes on the programme builder) and two highlights would
  // contradict each other about what the library is showing.
  function isActive(item: ClinicNavItem): boolean {
    if (palette.active) {
      const key = PALETTE_BY_HREF[item.href];
      return key ? palette.selected === key : false;
    }
    return item.href === activeHref;
  }

  // While building, the rail reads as a palette of things that can go into
  // the programme. Everything that isn't addable drops below the divider
  // with the rest of the admin pages -- de-emphasised, never removed, since
  // these are the only route to those pages.
  const buildable = palette.active
    ? CLINIC_NAV_PRIMARY.filter((i) => PALETTE_BY_HREF[i.href] || i.href === "/clinic/workouts")
    : CLINIC_NAV_PRIMARY;
  const manage = palette.active
    ? [...CLINIC_NAV_PRIMARY.filter((i) => !PALETTE_BY_HREF[i.href] && i.href !== "/clinic/workouts"), ...CLINIC_NAV_SECONDARY]
    : CLINIC_NAV_SECONDARY;

  return (
    <div className={styles.sidebar}>
      <button type="button" onClick={() => navigate("/clinic")} className={styles.sidebarBrand} aria-label="Home">
        <Image src="/icons/athena-mark.png" alt="" width={22} height={22} />
      </button>

      {palette.active && <div className={styles.sidebarGroupLabel}>Add to this workout</div>}

      <div className={styles.sidebarSection}>
        {buildable.map((item) => (
          <NavRow key={item.href} item={item} active={isActive(item)} onActivate={() => activate(item)} />
        ))}
      </div>

      <div className={styles.sidebarDivider} />

      {palette.active && <div className={styles.sidebarGroupLabel}>Manage</div>}

      <div className={styles.sidebarSection}>
        {manage.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            active={isActive(item)}
            muted={palette.active}
            onActivate={() => activate(item)}
          />
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
