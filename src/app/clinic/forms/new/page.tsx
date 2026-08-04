import Image from "next/image";
import styles from "../../clinic.module.css";
import FormBuilder from "../FormBuilder";
import ClinicBrandbar from "../../ClinicBrandbar";

// See the matching comment on other "new" pages -- without this, the
// formId below gets baked into a static page at build time and reused by
// every visitor until the next deploy.
export const dynamic = "force-dynamic";

export default async function NewFormPage() {
  const formId = crypto.randomUUID();

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>New form</h1>
        <p className={styles.subheading}>A title, and whatever questions you need.</p>

        <FormBuilder mode="create" formId={formId} initialTitle="" initialQuestions={[]} />
      </div>
    </div>
  );
}
