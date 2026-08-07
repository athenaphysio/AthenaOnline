import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MembershipTierList from "../MembershipTierList";
import sessionStyles from "../../session/TodaySession.module.css";
import styles from "../membership.module.css";

// The destination behind the landing page's "Finished your rehab?" nudge
// (see SuggestionCard.tsx) -- framing text explaining what continuing
// looks like, then the exact same four tier cards and checkout as
// /membership itself (via the shared MembershipTierList), so this is a
// second entry point into the one real membership flow, not a new one.
export default async function ContinueCarePage({
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
          <h1 className={styles.continueHeading}>What happens when your programme ends</h1>
          <p className={styles.continueBody}>
            Congratulations on completing your rehab. Do you want to keep working toward the movement goals that
            matter to you, whether that&apos;s family, travel, or simply feeling capable in everyday life? David
            now knows how your body works, and can build a programme that&apos;s genuinely personal to you. One
            that fits around your life, not the other way round. Here&apos;s what that looks like&hellip;
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
