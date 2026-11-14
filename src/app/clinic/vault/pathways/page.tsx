import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AthenaPathwayV1 } from "@/lib/pathways";
import ClinicBrandbar from "../../ClinicBrandbar";
import VaultTabs from "../VaultTabs";
import styles from "../VaultLibrary.module.css";
import pStyles from "./Pathways.module.css";
import PathwayImport from "./PathwayImport";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  region: string;
  pathology: string;
  status: "draft" | "approved";
  definition: AthenaPathwayV1;
  updated_at: string;
};

export default async function PathwaysPage() {
  const { data, error } = await supabaseAdmin
    .from("pathways")
    .select("id, name, region, pathology, status, definition, updated_at")
    .order("region")
    .order("name")
    .returns<Row[]>();
  if (error) throw new Error(`Pathways query failed: ${error.message}`);
  const rows = data ?? [];

  const regions = Array.from(new Set(rows.map((r) => r.region || "Other")));

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

        <VaultTabs active="pathways" />

        <div className={styles.settingsPane}>
          <h3>Pathways</h3>
          <div className={styles.sub}>
            Your clinical reasoning as flowcharts, one for each body region and pathology. Each pathway sets where a
            client starts, the core and optional drills at every stage, when to move on, and what to do after a
            flare-up. Approved pathways can build a client&apos;s programme straight from a working diagnosis.
          </div>

          <PathwayImport />

          {rows.length === 0 && (
            <p className={styles.sub} style={{ marginTop: 20 }}>
              No pathways yet. Paste one in from the Clinical Pathways Project to start.
            </p>
          )}

          {regions.map((region) => (
            <div key={region} className={pStyles.group}>
              <div className={pStyles.groupTitle}>{region}</div>
              <div className={pStyles.grid}>
                {rows
                  .filter((r) => (r.region || "Other") === region)
                  .map((r) => {
                    const drills = r.definition.stages.reduce((n, s) => n + s.drills.length, 0);
                    return (
                      <Link key={r.id} href={`/clinic/vault/pathways/${r.id}`} className={pStyles.card}>
                        <h4>{r.name}</h4>
                        <div className={pStyles.meta}>
                          <span className={`${pStyles.pill} ${r.status === "approved" ? pStyles.pillApproved : ""}`}>
                            {r.status === "approved" ? "Approved" : "Draft"}
                          </span>
                          {r.pathology && <span>{r.pathology}</span>}
                        </div>
                        <div className={pStyles.meta}>
                          {r.definition.stages.length} stages, {drills} drills, {r.definition.decisions.length} decision
                          {r.definition.decisions.length === 1 ? "" : "s"}
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
