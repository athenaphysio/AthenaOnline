import Link from "next/link";
import { notFound } from "next/navigation";
import { getExerciseOptions, getFlow } from "@/lib/flowsServer";
import ClinicBrandbar from "../../../ClinicBrandbar";
import VaultTabs from "../../VaultTabs";
import styles from "../../VaultLibrary.module.css";
import FlowEditor from "../FlowEditor";

export const dynamic = "force-dynamic";

export default async function EditFlowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [flow, exercises] = await Promise.all([getFlow(id), getExerciseOptions()]);
  if (!flow) notFound();

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
          <h3 style={{ marginTop: 10, marginBottom: 16 }}>{flow.title}</h3>
          <FlowEditor mode="edit" initial={flow} exercises={exercises} />
        </div>
      </div>
    </div>
  );
}
