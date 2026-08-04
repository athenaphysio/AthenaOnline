import { MEMBERSHIP_TIERS } from "@/lib/membershipTiers";
import { formatPriceGBPPrecise, formatPriceGBP } from "@/lib/currency";
import MembershipButton from "./MembershipButton";
import sessionStyles from "../session/TodaySession.module.css";
import styles from "./membership.module.css";

// The four tier cards, exactly as built for /membership -- extracted so
// this one rendering is shared by every entry point rather than copied.
// Each button is already wired to the real Stripe checkout (monthly ->
// subscription, upfront options -> one-off), see MembershipButton.tsx.
export default function MembershipTierList() {
  return (
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
  );
}
