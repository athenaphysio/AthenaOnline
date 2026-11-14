import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validatePathway, type AthenaPathwayV1 } from "@/lib/pathways";
import ClinicBrandbar from "../../../ClinicBrandbar";
import VaultTabs from "../../VaultTabs";
import styles from "../../VaultLibrary.module.css";
import PathwayEditor from "../PathwayEditor";

export const dynamic = "force-dynamic";

export default async function PathwayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: row }, { data: exercises }] = await Promise.all([
    supabaseAdmin
      .from("pathways")
      .select("id, status, definition")
      .eq("id", id)
      .maybeSingle<{ id: string; status: "draft" | "approved"; definition: AthenaPathwayV1 }>(),
    supabaseAdmin
      .from("exercises")
      .select("exercise_id, name_clinical")
      .eq("active", true)
      .order("name_clinical")
      .returns<{ exercise_id: string; name_clinical: string }[]>(),
  ]);
  if (!row) notFound();

  // Stored definitions were validated on the way in; this only fills in
  // anything an older save left out.
  const checked = validatePathway(row.definition);
  const definition = checked.valid ? checked.pathway : row.definition;

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
          <Link href="/clinic/vault/pathways" className={styles.sub} style={{ textDecoration: "underline", color: "inherit" }}>
            Back to all pathways
          </Link>
          <h3 style={{ marginTop: 10, marginBottom: 4 }}>{definition.name}</h3>
          <PathwayEditor
            id={row.id}
            initialStatus={row.status}
            initial={definition}
            exercises={(exercises ?? []).map((e) => ({ id: e.exercise_id, name: e.name_clinical }))}
          />
        </div>
      </div>
    </div>
  );
}
