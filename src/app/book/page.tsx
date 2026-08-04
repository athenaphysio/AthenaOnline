import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_LOCATIONS } from "@/lib/bookingLocations";
import styles from "./Book.module.css";

// Two clearly labelled outbound links, nothing else -- each practice's own
// booking system is already the real thing, this page just points to it.
// Reached from the "Book" link every patient screen carries (SessionHeader.tsx)
// and from the "Where I practise" section on /about, since "who's treating
// me" and "book to see them" naturally sit together. Same auth gate as the
// rest of the patient app.
export default async function BookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/start");
  }

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <div className={styles.brandbar}>
          <Link href="/session" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
            <Image src="/icons/athena-mark.png" alt="" width={26} height={26} />
            <div style={{ fontSize: 12.5, fontWeight: 500, letterSpacing: "0.08em", color: "var(--stone)", textTransform: "uppercase" }}>
              Athena Physio
            </div>
          </Link>
          <Link href="/session" className={styles.backLink}>
            ← Back
          </Link>
        </div>

        <div className={styles.body}>
          <h1 className={styles.heading}>Book a face-to-face appointment</h1>
          <p className={styles.paragraph}>
            Choose a location below to open its booking page in a new tab. Nothing here is booked through this app;
            each practice manages its own diary.
          </p>

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
