import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_LOCATIONS } from "@/lib/bookingLocations";
import { getPatientMembership, isActiveMembership } from "@/lib/membership";
import PageBanner from "@/components/PageBanner";
import styles from "./Book.module.css";

const REVIEW_BOOKING_URL = "https://athenaphysio.setmore.com/services/8d250048-ba7b-45a8-8c64-40e90e76c788";

// Clearly labelled outbound links, nothing else -- each booking system is
// already the real thing, this page just points to it. Reached from the
// "Booking" link every patient screen carries (QuickLinks.tsx) and from the
// "Where I practise" section on /about, since "who's treating me" and "book
// to see them" naturally sit together. Same auth gate as the rest of the
// patient app. The Review card up top is a paid-member perk -- see
// isActiveMembership(...) below -- and simply doesn't render for anyone else,
// no locked or upsell state for now.
export default async function BookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/start");
  }

  const membership = await getPatientMembership(user.id);
  const showReviewBooking = isActiveMembership(membership);

  return (
    <div className={styles.app}>
      <PageBanner
        href="/session"
        actions={
          <Link href="/session" className={styles.backLink}>
            ← Back
          </Link>
        }
      />
      <div className={styles.inner}>

        <div className={styles.body}>
          <h1 className={styles.heading}>Booking</h1>
          <p className={styles.paragraph}>
            Choose an option below to open its booking page in a new tab. Nothing here is booked through this app;
            each system manages its own diary.
          </p>

          {showReviewBooking && (
            <div className={styles.list}>
              <a href={REVIEW_BOOKING_URL} target="_blank" rel="noopener noreferrer" className={styles.card}>
                <div className={styles.cardName}>Book a Review</div>
                <p className={styles.cardPlace}>Included with your membership</p>
                <div className={styles.cardLink}>Book via Setmore ↗</div>
              </a>
            </div>
          )}

          <div className={styles.list}>
            {BOOKING_LOCATIONS.map((location) => (
              <a
                key={location.slug}
                href={location.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.card}
              >
                <div className={styles.cardName}>{location.name}</div>
                <p className={styles.cardPlace}>{location.place}</p>
                <div className={styles.cardLink}>Book via {location.system} ↗</div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
