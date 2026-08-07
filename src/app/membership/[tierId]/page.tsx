import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
//
// Content order: explainer text (one-liner + feature list, from
// athena_tier_explainer_copy.docx), price, image placeholder, Find out
// more (mailto enquiry), Buy (the real Stripe checkout, same for every
// tier including Athlete -- Find out more already covers the enquiry
// path the source doc asked about, so Athlete's Buy stays a normal
// instant checkout rather than a special-cased enquire-only button).
const ENQUIRY_EMAIL = "athenaphysio@gmail.com";

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

  const mailtoHref = `mailto:${ENQUIRY_EMAIL}?subject=${encodeURIComponent(`Enquiry: ${tier.name}`)}`;

  return (
    <div className={styles.tierPage} style={{ backgroundColor: tier.accent, color: tier.onAccent }}>
      <div className={styles.tierPageInner}>
        <Link href="/membership" className={styles.tierPageBack} style={{ color: tier.onAccent }}>
          ← Back
        </Link>

        {tier.label && <div className={styles.tierPageLabel}>{tier.label}</div>}
        <h1 className={styles.tierPageHeading}>{tier.name}</h1>

        <p className={styles.tierPageOneLiner}>{tier.oneLiner}</p>
        <ul className={styles.tierPageFeatures}>
          {tier.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>

        <p className={styles.tierPagePrice}>{formatPriceGBPPrecise(tier.monthlyPriceGBP)} / month</p>

        <div className={styles.tierPageImage}>
          <Image src={tier.image} alt="" fill sizes="480px" className={styles.tierPageImagePhoto} />
        </div>

        <div className={styles.tierPageButtons}>
          <a href={mailtoHref} className={styles.secondaryButton} style={{ color: tier.onAccent, borderColor: tier.onAccent }}>
            Find out more
          </a>
          <MembershipButton
            tierId={tier.id}
            option="monthly"
            label={`Buy, ${formatPriceGBPPrecise(tier.monthlyPriceGBP)}/month`}
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
