"use client";

import { useState } from "react";
import Image from "next/image";
import { MEMBERSHIP_TIERS } from "@/lib/membershipTiers";
import { formatPriceGBPPrecise, formatPriceGBP } from "@/lib/currency";
import TierBadgeIcon from "@/components/TierBadgeIcon";
import MembershipButton from "./MembershipButton";
import styles from "./membership.module.css";

const ENQUIRY_EMAIL = "athenaphysio@gmail.com";

// One page, four tier toggles, at most one expanded at a time -- tapping a
// tier's own toggle reveals its explainer text, photo, and actions in
// place, rather than sending the client to a separate page per tier.
export default function MembershipTierList() {
  const [openTierId, setOpenTierId] = useState<string | null>(null);

  return (
    <div className={styles.tierList}>
      {MEMBERSHIP_TIERS.map((tier) => {
        const isOpen = openTierId === tier.id;
        const mailtoHref = `mailto:${ENQUIRY_EMAIL}?subject=${encodeURIComponent(`Enquiry: ${tier.name}`)}`;

        return (
          <div key={tier.id} className={styles.tierBlock}>
            <button
              type="button"
              className={styles.tierToggle}
              style={{
                background: `linear-gradient(135deg, ${tier.accentDark}, ${tier.accent})`,
                color: tier.onAccent,
              }}
              aria-expanded={isOpen}
              onClick={() => setOpenTierId(isOpen ? null : tier.id)}
            >
              <span className={styles.tierToggleName}>
                <TierBadgeIcon size={22} />
                {tier.name}
              </span>
              <span className={styles.tierTogglePrice}>{formatPriceGBPPrecise(tier.monthlyPriceGBP)} / month</span>
            </button>

            {isOpen && (
              <div className={styles.tierExpanded} style={{ backgroundColor: tier.accent, color: tier.onAccent }}>
                {tier.label && <div className={styles.tierPageLabel}>{tier.label}</div>}
                <p className={styles.tierPageOneLiner}>{tier.oneLiner}</p>
                <ul className={styles.tierPageFeatures}>
                  {tier.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>

                <div className={styles.tierPageImage}>
                  <Image src={tier.image} alt="" fill sizes="480px" className={styles.tierPageImagePhoto} />
                </div>

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
                  <div className={styles.contactRow}>
                    <Image
                      src="/patient/david-signature-photo.jpg"
                      alt=""
                      width={32}
                      height={32}
                      className={styles.contactPhoto}
                      style={{ borderColor: tier.onAccent }}
                    />
                    <a
                      href={mailtoHref}
                      className={styles.secondaryButton}
                      style={{ color: tier.onAccent, borderColor: tier.onAccent }}
                    >
                      Contact David for more info
                    </a>
                  </div>
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
            )}
          </div>
        );
      })}
    </div>
  );
}
