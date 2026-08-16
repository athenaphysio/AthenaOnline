"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import ClinicSidebar from "./ClinicSidebar";
import styles from "./clinic.module.css";

// The sidebar wraps every authenticated /clinic page, but /clinic/login
// itself is reached before there's anything to navigate to -- rendering
// children bare there instead of inside the grid keeps the login page's own
// centred layout intact rather than squeezing it into a content column
// next to a sidebar nobody's authenticated to use yet.
export default function ClinicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/clinic/login") {
    return <>{children}</>;
  }
  return (
    <div className={styles.clinicShell}>
      <ClinicSidebar />
      <div className={styles.clinicShellContent}>{children}</div>
    </div>
  );
}
