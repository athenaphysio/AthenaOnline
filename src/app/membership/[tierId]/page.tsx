import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMembershipTier } from "@/lib/membershipTiers";
import { formatPriceGBPPrecise, formatPriceGBP } from "@/lib/currency";
import MembershipButton from "../MembershipButton";
import styles from "../membership.module.css";

// A tier's own page -- background is that tier's own colour, not just its
// button, with text switching to whichever of charcoal or white reads
// against it (see onAccent in membershipTiers.ts). No mountain watermark
// here; it's tuned for the cream page and would clash with a saturated
// tier colour.
export default async function MembershipTierPage({ params }: { params: Promise<{ tierId: string }> }) {
  const { tierId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/start");
  }

  const tier = getMembershipTier(tierId);
  if (!tier) {
    notFound();
  }

  return (
    <div className={styles.tierPage} style={{ backgroundColor: tier.accent, color: tier.onAccent }}>
      <div className={styles.tierPageInner}>
        <Link href="/membership" className={styles.tierPageBack} style={{ color: tier.onAccent }}>
          ← Back
        </Link>

        <h1 className={styles.tierPageHeading}>{tier.name}</h1>
        <div className={styles.tierPagePrice}>{formatPriceGBPPrecise(tier.monthlyPriceGBP)} / month</div>

        <div className={styles.tierPageButtons}>
          <MembershipButton
            tierId={tier.id}
            option="monthly"
            label={`Subscribe, ${formatPriceGBPPrecise(tier.monthlyPriceGBP)}/month`}
            accent={tier.accent}
            accentDark={tier.accentDark}
            onAccent={tier.onAccent}
            borderColor={tier.onAccent}
          />
          {tier.upfrontOptions.map((opt) => (
            <MembershipButton
              key={opt.key}
              tierId={tier.id}
              option={opt.key}
              label={`${opt.label}, ${formatPriceGBP(opt.priceGBP)}`}
              variant="secondary"
              onAccent={tier.onAccent}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
