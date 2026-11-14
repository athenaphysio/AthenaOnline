import Link from "next/link";
import styles from "../messenger.module.css";

// Which login to use. The messenger has no login of its own.
export default function RoamMessengerSignIn() {
  return (
    <main className={styles.app}>
      <div className={styles.centre}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand-packs/regenerate/roam-logo.png" alt="ROAM" className={styles.logo} />
        <h1 className={styles.title}>Roam Messenger</h1>
        <p className={styles.lead}>Messages with ROAM clients and the care team, kept inside the app and locked with Face ID.</p>
        <Link className={styles.primary} href="/coach/login?next=/roam-messenger">
          Sign in as a care team clinician
        </Link>
        <Link className={styles.secondary} href="/clinic/login?next=/roam-messenger">
          Sign in as Dr David Silver PhD
        </Link>
        <p className={styles.small}>You sign in once on each phone. After that, Face ID opens the app.</p>
      </div>
    </main>
  );
}
