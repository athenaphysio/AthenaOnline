import Image from "next/image";
import styles from "./TodaySession.module.css";

// A quiet signature detail at the very close of the landing page --
// headshot and tagline, immediately followed by the "Meet David & Friends"
// button (MeetDavidButton.tsx) as the last thing on the page. Deliberately
// unstyled as a card: no border, no background, so it never competes with
// the sections above it.
export default function SignatureFooter() {
  return (
    <div className={styles.signature}>
      <Image
        src="/patient/david-signature-photo.jpg"
        alt=""
        width={56}
        height={56}
        className={styles.signaturePhoto}
      />
      <p className={styles.signatureTagline}>
        <span className={styles.signatureMovement}>Movement</span> to{" "}
        <em className={styles.signatureEmpower}>Empower</em>.
      </p>
      <p className={styles.signatureName}>Dr David Silver PhD</p>
    </div>
  );
}
