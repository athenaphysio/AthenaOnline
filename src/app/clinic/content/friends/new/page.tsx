import styles from "../../../clinic.module.css";
import ClinicBrandbar from "../../../ClinicBrandbar";
import FriendForm from "../FriendForm";

// Same reasoning as blocks/new/page.tsx -- without this the id below would
// get baked into static HTML at build time and every visitor would share it.
export const dynamic = "force-dynamic";

export default function NewFriendPage() {
  const id = crypto.randomUUID();

  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>Add a friend</h1>
        <p className={styles.subheading}>Shown on the patient-facing &ldquo;Meet David &amp; Friends&rdquo; page.</p>

        <FriendForm
          mode="create"
          friendId={id}
          initialName=""
          initialJobTitle={null}
          initialPhotoUrl={null}
          initialBioText={null}
          initialWeblink={null}
        />
      </div>
    </div>
  );
}
