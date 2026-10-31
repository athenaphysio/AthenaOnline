import type { CSSProperties, ReactNode } from "react";
import styles from "../dashboard/ClientDashboard.module.css";
import PassportViewSwitch from "./PassportViewSwitch";
import { resolveBrandPack } from "@/lib/brandPackResolve";
import { paletteClientVars, rgba } from "@/lib/brandPalette";

// The client's passport screens, framed on a panel inside the clinic so
// they look as they do on the client's phone: the standard light panel, or
// for a brand pack with its own palette (Regenerate), the client's navy.
export default async function PassportVisual({
  patientId,
  clientName,
  enabled,
  draftCount,
  children,
}: {
  patientId: string;
  clientName: string;
  enabled: boolean;
  draftCount: number;
  children: ReactNode;
}) {
  const brand = await resolveBrandPack({ patientId }).catch(() => null);
  const palette = brand && !brand.isAllDefault ? brand.app_layout.palette : null;
  const panel: CSSProperties = palette
    ? ({
        ...paletteClientVars(palette),
        background: palette.base,
        color: palette.text,
        border: `1px solid ${rgba(palette.blue, 0.6)}`,
        borderRadius: 20,
        padding: "14px 6px 6px",
        maxWidth: 760,
      } as CSSProperties)
    : { background: "#f2ede4", color: "#1c1c1c", borderRadius: 20, padding: "14px 6px 6px", maxWidth: 760 };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <p className={styles.muted} style={{ margin: 0, fontSize: 13.5, maxWidth: 640 }}>
          The passport as your care team sees it, with every result
          {draftCount > 0 ? `, including ${draftCount} draft${draftCount === 1 ? "" : "s"} the client cannot see yet` : ""}. Use Client view to see
          only what the client sees.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <PassportViewSwitch patientId={patientId} clientName={clientName} initialEnabled={enabled} />
          <a href={`/clinic/patients/${patientId}/background?part=physiology`} className={`${styles.btn} ${styles.btnGhost}`}>
            Add or edit passport data
          </a>
        </div>
      </div>
      <div style={panel}>{children}</div>
    </>
  );
}
