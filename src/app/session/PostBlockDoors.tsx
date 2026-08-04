import AudioPlayer from "./AudioPlayer";
import BuyOutrightButton from "./BuyOutrightButton";
import MembershipButton from "../membership/MembershipButton";
import { formatPriceGBP, formatPriceGBPPrecise } from "@/lib/currency";
import shopStyles from "../shop/shop.module.css";
import styles from "./TodaySession.module.css";

type Props = {
  programmeId: string;
  completionAudioUrl: string | null;
};

// The real decision point, reached once a scheduled block has actually
// finished -- not the earlier "four weeks out" heads up (TermEndingCard),
// which deliberately asks for no decision at all. Three doors, each a
// genuinely different path, never ranked against each other.
//
// The "book a call" button is a mailto link for now -- there's no real
// booking tool wired in yet. If David has a Calendly link or similar,
// swap the href below for that instead.
const BOOKING_EMAIL =
  "mailto:athenaphysio@gmail.com?subject=" + encodeURIComponent("I'd like to book a call about my next block");

export default function PostBlockDoors({ programmeId, completionAudioUrl }: Props) {
  return (
    <div className={styles.card} style={{ padding: "20px 22px" }}>
      <div
        style={{
          fontFamily: "var(--font-fraunces), serif",
          fontSize: 24,
          fontWeight: 500,
          color: "var(--charcoal)",
        }}
      >
        You did it.
      </div>

      {completionAudioUrl && (
        <div style={{ marginTop: 14 }}>
          <AudioPlayer src={completionAudioUrl} label="A word from David" />
        </div>
      )}

      <p style={{ fontSize: 14, color: "var(--stone)", lineHeight: 1.55, marginTop: 14 }}>
        That flat feeling a week or two after a big one is real, and it catches nearly everyone out. The
        quickest way through it is having the next thing in front of you.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
        {/* Door 1 */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--charcoal)" }}>
            I&apos;ve got another one in me
          </div>
          <p style={{ fontSize: 13.5, color: "var(--stone)", lineHeight: 1.5, marginTop: 6 }}>
            Tell me what&apos;s next and we&apos;ll build the block for it.
          </p>
          <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, marginTop: 4 }}>
            Renew before your block ends and you keep your current rate.
          </p>
          <a
            href={BOOKING_EMAIL}
            className={shopStyles.buyButton}
            style={{ display: "inline-flex", marginTop: 10, textDecoration: "none" }}
          >
            Book a call with David
          </a>
        </div>

        {/* Door 2 */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--charcoal)" }}>I want to keep this fitness</div>
          <p style={{ fontSize: 13.5, color: "var(--stone)", lineHeight: 1.5, marginTop: 6 }}>
            No date, no peak, just staying strong and moving well.
          </p>
          <div style={{ marginTop: 10 }}>
            <a href="/membership" className={shopStyles.buyButton} style={{ display: "inline-flex", textDecoration: "none" }}>
              See the monthly options
            </a>
          </div>

          <p style={{ fontSize: 13.5, color: "var(--stone)", lineHeight: 1.5, marginTop: 16 }}>
            Or keep exactly what you have, for good, a one-off {formatPriceGBP(39)}, no more payments ever.
          </p>
          <div style={{ marginTop: 10 }}>
            <BuyOutrightButton programmeId={programmeId} label={`Keep it, ${formatPriceGBP(39)} one off`} />
          </div>
        </div>

        {/* Door 3 */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--charcoal)" }}>I need a breather</div>
          <p style={{ fontSize: 13.5, color: "var(--stone)", lineHeight: 1.5, marginTop: 6 }}>
            Keep your programme and a line to me open. Come back when you&apos;re ready.
          </p>
          <div style={{ marginTop: 10 }}>
            <MembershipButton
              tierId="member"
              option="monthly"
              label={`Stay connected, ${formatPriceGBPPrecise(5.99)} a month`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
