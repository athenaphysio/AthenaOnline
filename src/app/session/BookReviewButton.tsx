import styles from "./TodaySession.module.css";

const REVIEW_BOOKING_URL = "https://athenaphysio.setmore.com/services/8d250048-ba7b-45a8-8c64-40e90e76c788";

// Paid members only -- see the isActiveMembership(...) check in page.tsx,
// which decides whether this renders at all. No locked/upsell state for
// non-members for now, it's simply absent.
export default function BookReviewButton() {
  return (
    <div className={styles.quickLinks}>
      <a
        href={REVIEW_BOOKING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.quickLinkButton} ${styles.quickLinkReview}`}
      >
        Book a Review
      </a>
    </div>
  );
}
