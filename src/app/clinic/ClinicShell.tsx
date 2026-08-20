"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import ClinicSidebar from "./ClinicSidebar";
import { BuilderPaletteProvider, useBuilderPalette } from "./BuilderPaletteContext";
import styles from "./clinic.module.css";

// Reads the palette context, so it has to live inside BuilderPaletteProvider
// rather than in ClinicShell itself (which renders the provider).
function ClinicShellInner({ children }: { children: ReactNode }) {
  const palette = useBuilderPalette();
  // While a builder's own Content library panel is open (palette.active),
  // it already offers exactly this rail's navigation -- the same content
  // types, one click away in the panel's own tabs -- so the rail is dropped
  // entirely rather than shown as a redundant second menu, and the builder
  // gets that 220px back. Home stays reachable via ClinicBrandbar's own
  // mark at the top of the page, same reasoning as the Vault bypass below.
  // The grid itself stays (it also owns the shared canvas background for
  // the whole app), just collapsed to one column.
  return (
    <div className={`${styles.clinicShell} ${palette.active ? styles.clinicShellNoSidebar : ""}`}>
      {!palette.active && <ClinicSidebar />}
      <div className={styles.clinicShellContent}>{children}</div>
    </div>
  );
}

// The sidebar wraps every authenticated /clinic page, but /clinic/login
// itself is reached before there's anything to navigate to -- rendering
// children bare there instead of inside the grid keeps the login page's own
// centred layout intact rather than squeezing it into a content column
// next to a sidebar nobody's authenticated to use yet.
export default function ClinicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Vault is its own full-bleed surface with its own tab navigation, so it
  // gets no sidebar: the rail was a 220px column squeezing a design built
  // to fill the screen, and duplicating navigation Vault already has. The
  // Athena mark at the top of every Vault page is the way back out.
  if (pathname === "/clinic/login" || pathname === "/clinic/vault" || pathname.startsWith("/clinic/vault/")) {
    return <>{children}</>;
  }
  return (
    <BuilderPaletteProvider>
      <ClinicShellInner>{children}</ClinicShellInner>
    </BuilderPaletteProvider>
  );
}
