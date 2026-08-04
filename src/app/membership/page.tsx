import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MEMBERSHIP_TIERS } from "@/lib/membershipTiers";
import { formatPriceGBPPrecise, formatPriceGBP } from "@/lib/currency";
import MembershipButton from "./MembershipButton";
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

        <div className={styles.tierList}>
          {MEMBERSHIP_TIERS.map((tier) => (
            <div key={tier.id} className={sessionStyles.card}>
              <div className={styles.tierName}>{tier.name}</div>
              <div className={styles.tierPrice}>{formatPriceGBPPrecise(tier.monthlyPriceGBP)} / month</div>
              <MembershipButton
                tierId={tier.id}
                option="monthly"
                label={`Subscribe, ${formatPriceGBPPrecise(tier.monthlyPriceGBP)}/month`}
              />
              {tier.upfrontOptions.length > 0 && (
                <div className={styles.upfrontRow}>
                  {tier.upfrontOptions.map((opt) => (
                    <MembershipButton
                      key={opt.key}
                      tierId={tier.id}
                      option={opt.key}
                      label={`${opt.label}, ${formatPriceGBP(opt.priceGBP)}`}
                      variant="secondary"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
