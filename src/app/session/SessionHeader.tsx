import Image from "next/image";
import type { ReactNode } from "react";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";
import styles from "./TodaySession.module.css";

type Props = {
  firstName: string;
  /** Defaults to "Hi" -- deliberately time-of-day-agnostic, so it's never
   * showing "Morning" in the afternoon. */
  greeting?: string;
  /** Small label above the heading (e.g. "Today's session", "Rest day").
   * Omitted on the landing page itself, which isn't describing a state. */
  eyebrow?: string;
  /** A line under the heading -- typically the programme title. */
  subtitle?: ReactNode;
  /** Block content under the greeting, e.g. the programme title and
   * progress bar on the main dashboard. Separate from subtitle since it
   * isn't plain text -- rendered as a div, not nested inside the <p>. */
  belowHeading?: ReactNode;
  /** A tall column to the right of the greeting (the goal picture on the
   * main dashboard). When present, the greeting and belowHeading sit in a
   * left column that determines the row's height, and this stretches to
   * match it. */
  rightRail?: ReactNode;
  /** An optional confirmation banner (e.g. after a Stripe redirect back),
   * rendered right below the greeting. */
  banner?: ReactNode;
  /** The client's brand. A brand pack shows its own logo and home line
   * beside the greeting in place of David's photo and "Let's Move". */
  brand?: ResolvedBrandPack;
};

// "Measure. Move. Recover." becomes one short line per sentence.
function taglineLines(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// The greeting block for every patient-facing session screen. The
// logo/wordmark/notification-bell row that used to open this component
// has moved out to SiteBanner.tsx, a full-bleed banner rendered above
// .inner in page.tsx, rather than living inside this max-width column.
// This used to say "Hello, David." with a second "Hi David [avatar]"
// greeting duplicated further down on the dashboard itself
// (PatientDashboard.tsx) -- merged into one greeting here instead.
export default function SessionHeader({ firstName, greeting = "Hi", eyebrow, subtitle, belowHeading, rightRail, banner, brand }: Props) {
  const branded = Boolean(brand && !brand.isAllDefault);
  const brandLogo = branded
    ? brand!.app_layout.greeting_image || brand!.logo_mark_url || brand!.small_square_url
    : null;
  const lines = branded ? taglineLines(brand!.app_layout.home_tagline) : [];
  const greetingBlock = (
    <div>
      {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
      <h1>
        {greeting} <em>{firstName}</em>
      </h1>
      {branded ? (
        (brandLogo || lines.length > 0) && (
          <p className={styles.headLetsMove}>
            {brandLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brandLogo} alt="" width={52} height={56} className={styles.headAvatar} />
            )}
            {lines.length > 0 && (
              <span className={`${styles.headLetsMoveText} ${styles.headTaglineBrand}`}>
                {lines.map((line, i) => (
                  <span key={i} style={{ display: "block" }}>
                    {line}
                  </span>
                ))}
              </span>
            )}
          </p>
        )
      ) : (
        <p className={styles.headLetsMove}>
          <Image
            src="/patient/greeting-avatar.png"
            alt=""
            width={52}
            height={56}
            className={styles.headAvatar}
          />
          <span className={styles.headLetsMoveText}>
            Let&apos;s
            <br />
            Move
          </span>
        </p>
      )}
      {subtitle && <p>{subtitle}</p>}
      {belowHeading}
    </div>
  );

  return (
    <>
      <div className={styles.head}>
        {rightRail ? (
          <div className={styles.headRow}>
            {greetingBlock}
            {rightRail}
          </div>
        ) : (
          greetingBlock
        )}
      </div>

      {banner}
    </>
  );
}
