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
            A programme like yours builds something that doesn&apos;t show up on a page, a working picture of how
            your body actually responds. What loads well. What needs care. What&apos;s worked, and what
            hasn&apos;t. That&apos;s not generic knowledge you could get from any trainer or any app. It&apos;s
            specific to you, and it took real time to build.
          </p>
          <p className={styles.continueBody}>
            Most things people move on to after rehab start again from zero, with someone who&apos;s never met
            them. What&apos;s below isn&apos;t that. It&apos;s a way of keeping the same clinical picture working
            for you, instead of it closing the day your programme ends.
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
