import Link from "next/link";
import type { CSSProperties } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import clinicStyles from "../../clinic.module.css";
import VaultTabs from "../VaultTabs";
import styles from "../VaultLibrary.module.css";
import ClinicBrandbar from "../../ClinicBrandbar";
import FriendsListClient, { type FriendRow } from "./FriendsListClient";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const { data, error } = await supabaseAdmin
    .from("friends")
    .select("id, name, job_title, photo_url, sort_order")
    .order("sort_order")
    .returns<FriendRow[]>();

  if (error) {
    throw new Error(`Friends list query failed: ${error.message}`);
  }

  const friends = data ?? [];

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
          <h3>Meet David &amp; Friends</h3>
          <div className={styles.sub}>
            Everyone shown on the client-facing &ldquo;Meet David &amp; Friends&rdquo; page, in the order they
            appear.
          </div>

          <div className={clinicStyles.actions} style={{ marginTop: 0, marginBottom: 20 }}>
            <Link
              href="/clinic/vault/friends/new"
              className={clinicStyles.buttonSecondaryAccent}
              style={{ "--zone-accent": "var(--accent-content)", "--zone-accent-soft": "var(--accent-content-soft)" } as CSSProperties}
            >
              + Add a friend
            </Link>
          </div>

          {friends.length === 0 && <p className={clinicStyles.notice}>No one added yet.</p>}

          <FriendsListClient friends={friends} />
        </div>
      </div>
    </div>
  );
}
