import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../../../clinic.module.css";
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
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>Edit friend</h1>

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
  );
}
