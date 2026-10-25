import Link from "next/link";
import type { CSSProperties } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  BODY_AREA_LABELS,
  CATEGORY_LABELS,
  FLOW_MOVE_SELECT,
  FLOW_SELECT,
  STATUS_LABELS,
  flowFromRows,
  flowSeconds,
  formatDuration,
  type Flow,
  type FlowBodyArea,
} from "@/lib/flows";
import clinicStyles from "../../clinic.module.css";
import ClinicBrandbar from "../../ClinicBrandbar";
import VaultTabs from "../VaultTabs";
import styles from "../VaultLibrary.module.css";
import flowStyles from "./Flows.module.css";

export const dynamic = "force-dynamic";

const AREA_ORDER: FlowBodyArea[] = ["upper_limb", "lower_limb", "whole_body"];

export default async function FlowsPage() {
  const [flowsRes, movesRes] = await Promise.all([
    supabaseAdmin.from("flows").select(FLOW_SELECT).order("sort_order").order("title"),
    supabaseAdmin.from("flow_moves").select(FLOW_MOVE_SELECT),
  ]);
  if (flowsRes.error) throw new Error(`Flows query failed: ${flowsRes.error.message}`);
  if (movesRes.error) throw new Error(`Flow moves query failed: ${movesRes.error.message}`);

  const movesByFlow = new Map<string, NonNullable<typeof movesRes.data>>();
  for (const m of movesRes.data ?? []) {
    if (!movesByFlow.has(m.flow_id)) movesByFlow.set(m.flow_id, []);
    movesByFlow.get(m.flow_id)!.push(m);
  }
  const flows: Flow[] = (flowsRes.data ?? []).map((row) => flowFromRows(row, movesByFlow.get(row.id) ?? []));

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <ClinicBrandbar />

        <div className={styles.topbar}>
          <div>
            <h1>Vault</h1>
            <div className={styles.sub}>Build and manage your reusable exercises, blocks, workouts, and programmes</div>
          </div>
        </div>

        <VaultTabs active="flows" />

        <div className={styles.settingsPane}>
          <h3>Flows</h3>
          <div className={styles.sub}>
            Follow along movement programmes that stand on their own and run alongside workouts, blocks, activations,
            injury prevention and cardio. Each flow is a list of timed moves, which is also the script for the filming
            prompter.
          </div>

          <div className={clinicStyles.actions} style={{ marginTop: 16, marginBottom: 0 }}>
            <Link
              href="/clinic/vault/flows/new"
              className={clinicStyles.buttonSecondaryAccent}
              style={{ "--zone-accent": "var(--accent-content)", "--zone-accent-soft": "var(--accent-content-soft)" } as CSSProperties}
            >
              + New flow
            </Link>
          </div>

          {flows.length === 0 && <p className={clinicStyles.notice}>No flows yet.</p>}

          {AREA_ORDER.map((area) => {
            const inArea = flows.filter((f) => f.bodyArea === area);
            if (inArea.length === 0) return null;
            return (
              <div key={area} className={flowStyles.group}>
                <div className={flowStyles.groupTitle}>{BODY_AREA_LABELS[area]}</div>
                <div className={flowStyles.grid}>
                  {inArea.map((f) => (
                    <Link key={f.id} href={`/clinic/vault/flows/${f.id}`} className={flowStyles.flowCard}>
                      <h4>{f.title}</h4>
                      <div className={flowStyles.cardMeta}>
                        <span
                          className={`${flowStyles.pill} ${
                            f.status === "live" ? flowStyles.pillLive : f.status === "filmed" ? flowStyles.pillFilmed : flowStyles.pillDraft
                          }`}
                        >
                          {STATUS_LABELS[f.status]}
                        </span>
                        <span className={flowStyles.pill}>{CATEGORY_LABELS[f.category]}</span>
                      </div>
                      <div className={flowStyles.cardMeta}>
                        {f.moves.length} moves · {formatDuration(flowSeconds(f.moves))}
                        {f.entryPoint ? ` · ${f.entryPoint}` : ""}
                      </div>
                      {f.summary && <p className={flowStyles.cardSummary}>{f.summary}</p>}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
