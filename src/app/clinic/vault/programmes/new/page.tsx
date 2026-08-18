import ClinicBrandbar from "../../../ClinicBrandbar";
import VaultTabs from "../../VaultTabs";
import ProgrammeTemplateBuilder from "../../../programme-templates/ProgrammeTemplateBuilder";
import libraryStyles from "../../VaultLibrary.module.css";
import styles from "../VaultProgrammes.module.css";

// Same reasoning as the other Vault "new" pages -- no dynamic API of its
// own, so without this every visit would reuse the same crypto.randomUUID()
// baked in at build time.
export const dynamic = "force-dynamic";

export default async function NewVaultProgrammeTemplatePage() {
  const templateId = crypto.randomUUID();

  return (
    <div className={libraryStyles.page}>
      <div className={libraryStyles.wrap}>
        <ClinicBrandbar />

        <div className={libraryStyles.topbar}>
          <div>
            <h1>Vault</h1>
            <div className={libraryStyles.sub}>Build and manage your reusable exercises, blocks, workouts, and programmes</div>
          </div>
        </div>

        <VaultTabs active="programmes" />

        <div className={`${styles.card} ${styles.darkFormScope}`} style={{ padding: "26px 28px" }}>
          <h3 style={{ marginBottom: 20 }}>New programme template</h3>
          <p className={styles.builderIntro}>
            Sessions come from the Vault Sessions library, search for one on the right once you get to the weekly
            schedule below.
          </p>

          <ProgrammeTemplateBuilder mode="create" templateId={templateId} initialName="" initialBlockLengthWeeks={4} initialAssignments={[]} />
        </div>
      </div>
    </div>
  );
}
