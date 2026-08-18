import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import VaultTabs from "../../VaultTabs";
import styles from "../../VaultLibrary.module.css";
import ClinicBrandbar from "../../../ClinicBrandbar";
import FriendForm from "../FriendForm";

export const dynamic = "force-dynamic";

type Friend = {
  id: string;
  name: string;
  job_title: string | null;
  photo_url: string | null;
  bio_text: string | null;
  weblink: string | null;
};

export default async function EditFriendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: friend } = await supabaseAdmin
    .from("friends")
    .select("id, name, job_title, photo_url, bio_text, weblink")
    .eq("id", id)
    .maybeSingle<Friend>();

  if (!friend) {
    notFound();
  }

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
          <h3>Edit friend</h3>

        <FriendForm
          mode="edit"
          friendId={friend.id}
          initialName={friend.name}
          initialJobTitle={friend.job_title}
          initialPhotoUrl={friend.photo_url}
          initialBioText={friend.bio_text}
          initialWeblink={friend.weblink}
        />
        </div>
      </div>
    </div>
  );
}
