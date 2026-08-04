import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MembershipTierList from "./MembershipTierList";
import sessionStyles from "../session/TodaySession.module.css";
import styles from "./membership.module.css";

export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string }>;
}) {
  const { purchase } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/start");
  }

  return (
    <div className={sessionStyles.app}>
      <div className={sessionStyles.inner}>
        <div className={styles.header}>
          <div className={styles.heading}>Membership</div>
          <p className={styles.subheading}>
            Choose the level of support that fits, month to month or paid upfront.
          </p>
        </div>

        {purchase === "success" && <div className={styles.banner}>Payment received, thank you. You're set up.</div>}
        {purchase === "cancelled" && (
          <div className={styles.bannerMuted}>Checkout was cancelled, nothing was charged.</div>
        )}

        <MembershipTierList />
      </div>
    </div>
  );
}
