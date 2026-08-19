import type { ReactNode } from "react";
import styles from "./TodaySession.module.css";
import SessionHeader from "./SessionHeader";
import { brandScopeStyle } from "./brandScopeStyle";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";

export default function RestDayScreen({
  firstName,
  banner,
  brand,
}: {
  firstName: string;
  banner?: ReactNode;
  brand?: ResolvedBrandPack;
}) {
  return (
    <div className={styles.app} style={brandScopeStyle(brand)}>
      <div className={styles.inner}>
        <SessionHeader firstName={firstName} eyebrow="Rest day" banner={banner} />
        <p style={{ padding: "0 22px", fontSize: 14, color: "var(--stone)", lineHeight: 1.55 }}>
          Nothing scheduled today. Enjoy the rest, your next session will be here when it&apos;s due.
        </p>
      </div>
    </div>
  );
}
