import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../ClinicBrandbar";
import VaultTabs from "../VaultTabs";
import styles from "../VaultLibrary.module.css";
import BlockUsageTagManagerClient, { type BlockUsageTagRow } from "./BlockUsageTagManagerClient";

export const dynamic = "force-dynamic";

export default async function VaultBlockUsageTagsPage() {
  const [{ data: tags, error }, { data: links }] = await Promise.all([
    supabaseAdmin.from("block_usage_tags").select("id, name").order("name").returns<{ id: string; name: string }[]>(),
    supabaseAdmin.from("block_usage_tag_links").select("tag_id").returns<{ tag_id: string }[]>(),
  ]);

  if (error) {
    throw new Error(`Block usage tag list query failed: ${error.message}`);
  }

  const usageCounts = new Map<string, number>();
  for (const l of links ?? []) usageCounts.set(l.tag_id, (usageCounts.get(l.tag_id) ?? 0) + 1);

  const rows: BlockUsageTagRow[] = (tags ?? []).map((t) => ({ ...t, usageCount: usageCounts.get(t.id) ?? 0 }));

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

        <VaultTabs active="block-usage-tags" />

        <div className={styles.settingsPane}>
          <h3>Block usage tags</h3>
          <div className={styles.sub}>
            A second, finer label on top of a block&apos;s Type, for what it&apos;s actually for, so &quot;Main Body&quot;
            isn&apos;t the only way to find it again. Add, rename, or remove tags here, or add a new one directly from
            the block editor.
          </div>
          <BlockUsageTagManagerClient tags={rows} />
        </div>
      </div>
    </div>
  );
}
