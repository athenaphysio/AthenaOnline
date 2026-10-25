import Link from "next/link";
import { getExerciseOptions } from "@/lib/flowsServer";
import ClinicBrandbar from "../../../ClinicBrandbar";
import VaultTabs from "../../VaultTabs";
import styles from "../../VaultLibrary.module.css";
import FlowEditor from "../FlowEditor";

// Same reasoning as friends/new -- without this the id below would be baked
// into static HTML at build time and every visitor would share it.
export const dynamic = "force-dynamic";

export default async function NewFlowPage() {
  const id = crypto.randomUUID();
  const exercises = await getExerciseOptions();

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
          <Link href="/clinic/vault/flows" className={styles.sub} style={{ textDecoration: "underline", color: "inherit" }}>
            Back to all flows
          </Link>
          <h3 style={{ marginTop: 10, marginBottom: 16 }}>New flow</h3>
          <FlowEditor
            mode="create"
            exercises={exercises}
            initial={{
              id,
              title: "",
              category: "everyday_task",
              bodyArea: "whole_body",
              entryPoint: "",
              summary: "",
              status: "draft",
              vimeoUrl: "",
              notes: "",
              moves: [{ name: "Settle and breathe", seconds: 20, breathSeconds: 8, side: "", cue: "", exerciseId: null }],
            }}
          />
        </div>
      </div>
    </div>
  );
}
