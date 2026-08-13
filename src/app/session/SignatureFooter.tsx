import Image from "next/image";
import styles from "./TodaySession.module.css";

// A quiet signature detail right under the landing page's hero content
// (today's session / continue card) -- headshot and tagline, immediately
// followed by the "Meet David & Friends" button (MeetDavidButton.tsx) as
// the close of that same moment. Deliberately unstyled as a card: no
// border, no background, so it never competes with the card above it.
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
