import Image from "next/image";
import styles from "../../clinic.module.css";
import ProgrammeTemplateBuilder from "../ProgrammeTemplateBuilder";
import ClinicBrandbar from "../../ClinicBrandbar";

// See the matching comment in clinic/blocks/new/page.tsx -- without this,
// the templateId below gets baked into a static page at build time and
// reused by every visitor until the next deploy.
export const dynamic = "force-dynamic";

export default async function NewProgrammeTemplatePage() {
  const templateId = crypto.randomUUID();

  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>New programme template</h1>
        <p className={styles.subheading}>Build a reusable weekly schedule from your Workouts.</p>

        <ProgrammeTemplateBuilder
          mode="create"
          templateId={templateId}
          initialName=""
          initialBlockLengthWeeks={4}
          initialAssignments={[]}
        />
      </div>
    </div>
  );
}
