import Link from "next/link";
import ClientShell from "../ClientShell";
import HexMap from "@/components/HexMap";
import { BODY_AREA_LABELS, flowSeconds, type Flow } from "@/lib/flows";
import { TOOL_ARMS, armForFlow, toolArm } from "@/lib/tools";
import type { ClientAppContext } from "@/lib/clientApp";
import styles from "./Screens.module.css";

function minutes(totalSeconds: number): string {
  const m = Math.max(1, Math.round(totalSeconds / 60));
  return `${m} minute${m === 1 ? "" : "s"}`;
}

// The Tools tab: breath, nervous system and mind resources the client can
// open whenever they like. The three hexagons choose the area; underneath
// are that area's live Flows from the Vault. Nothing here is programmed or
// logged, so it carries no streaks and no record of use.
export default function ToolsScreen({
  ctx,
  flows,
  arm,
  base = "/session/tools",
}: {
  ctx: ClientAppContext;
  flows: Flow[];
  arm?: string;
  /** Where the hexagons point, so the clinic's Client view can show the same screen. */
  base?: string;
}) {
  const open = toolArm(arm);
  const join = base.includes("?") ? "&" : "?";
  const inArm = (key: string) => flows.filter((f) => armForFlow(f)?.key === key);
  const items = TOOL_ARMS.map((a) => {
    const n = inArm(a.key).length;
    return {
      key: a.key,
      label: a.label,
      line: a.line,
      meta: n > 0 ? `${n} ready` : "Coming soon",
      href: `${base}${join}arm=${a.key}`,
      description: a.detail,
    };
  });
  const shown = inArm(open.key);

  return (
    <ClientShell
      ctx={ctx}
      active="tools"
      title="Tools"
      lead="Resources to use whenever you need them, alongside your programme. Choose an area, then a practice."
    >
      <div className={styles.hexWrap}>
        <HexMap items={items} open={open.key} ariaLabel={`Tools: ${TOOL_ARMS.map((a) => a.label.toLowerCase()).join(", ")}`} maxWidth={520} />
      </div>
      <p className={styles.armIntro}>{open.detail}</p>

      <div className={styles.stack}>
        {shown.length === 0 && (
          <div className={styles.card}>
            <p className={styles.muted}>
              {open.label} practices are being prepared and will appear here as soon as each one is ready.
            </p>
          </div>
        )}
        {shown.map((f) => (
          <Link key={f.id} href={`/session/tools/${f.id}`} className={`${styles.card} ${styles.toolCard}`}>
            <h2 className={styles.cardTitle}>{f.title}</h2>
            <span className={styles.toolGo} aria-hidden="true">
              ▶
            </span>
            {f.summary && <p className={styles.muted}>{f.summary}</p>}
            <p className={styles.toolMeta}>
              {[f.moves.length ? minutes(flowSeconds(f.moves)) : f.vimeoUrl ? "Video" : "", f.entryPoint, f.bodyArea !== "whole_body" ? BODY_AREA_LABELS[f.bodyArea] : ""]
                .filter(Boolean)
                .join(", ")}
            </p>
          </Link>
        ))}
      </div>
    </ClientShell>
  );
}
