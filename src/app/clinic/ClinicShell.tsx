"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import ClinicSidebar from "./ClinicSidebar";
import { BuilderPaletteProvider } from "./BuilderPaletteContext";
import styles from "./clinic.module.css";

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
      <div className={styles.clinicShell}>
        <ClinicSidebar />
        <div className={styles.clinicShellContent}>{children}</div>
      </div>
    </BuilderPaletteProvider>
  );
}
