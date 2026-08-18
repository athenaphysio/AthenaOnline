import VaultTabs from "../../VaultTabs";
import styles from "../../VaultLibrary.module.css";
import ClinicBrandbar from "../../../ClinicBrandbar";
import FriendForm from "../FriendForm";

// Same reasoning as blocks/new/page.tsx -- without this the id below would
// get baked into static HTML at build time and every visitor would share it.
export const dynamic = "force-dynamic";

export default function NewFriendPage() {
  const id = crypto.randomUUID();

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

        <VaultTabs active="friends" />

        <div className={styles.settingsPane}>
          <h3>Add a friend</h3>
          <div className={styles.sub}>Shown on the client-facing &ldquo;Meet David &amp; Friends&rdquo; page.</div>

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
    </div>
  );
}
