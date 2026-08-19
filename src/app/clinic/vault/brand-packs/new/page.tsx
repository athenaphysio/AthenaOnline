import VaultTabs from "../../VaultTabs";
import styles from "../../VaultLibrary.module.css";
import ClinicBrandbar from "../../../ClinicBrandbar";
import BrandPackEditor from "../BrandPackEditor";

// Without this, Next.js prerenders this page once at build time, baking
// the crypto.randomUUID() below into static HTML -- every visitor gets
// the same packId until the next deploy. Must stay dynamic.
export const dynamic = "force-dynamic";

export default function NewBrandPackPage() {
  const packId = crypto.randomUUID();

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

        <VaultTabs active="brand-packs" />

        <div className={styles.settingsPane}>
          <h3>New brand pack</h3>
          <div className={styles.sub} style={{ marginBottom: 18 }}>
            Give it a name and two colours to save it -- images can be added now or any time later.
          </div>

          <BrandPackEditor
            mode="create"
            packId={packId}
            isDefault={false}
            initial={{
              name: "",
              accent_color: "#B83A60",
              background_color: "#EFEAE6",
              logo_mark_url: null,
              wordmark_url: null,
              cover_square_url: null,
              wide_banner_url: null,
              small_square_url: null,
              background_texture_url: null,
            }}
            usage={null}
          />
        </div>
      </div>
    </div>
  );
}
