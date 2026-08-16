import Link from "next/link";
import type { CSSProperties } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import clinicStyles from "../../clinic.module.css";
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
    <div className={clinicStyles.app}>
      <div className={clinicStyles.inner}>
        <ClinicBrandbar />

        <h1 className={clinicStyles.heading}>Meet David &amp; Friends</h1>
        <p className={clinicStyles.subheading}>
          Everyone shown on the patient-facing &ldquo;Meet David &amp; Friends&rdquo; page, in the order they
          appear.
        </p>

        <div className={clinicStyles.actions} style={{ marginTop: 0, marginBottom: 20 }}>
          <Link
            href="/clinic/content/friends/new"
            className={clinicStyles.buttonSecondaryAccent}
            style={{ "--zone-accent": "var(--accent-content)", "--zone-accent-soft": "var(--accent-content-soft)" } as CSSProperties}
          >
            + Add a friend
          </Link>
        </div>

        {friends.length === 0 && (
          <p className={clinicStyles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            No one added yet.
          </p>
        )}

        <FriendsListClient friends={friends} />
      </div>
    </div>
  );
}
