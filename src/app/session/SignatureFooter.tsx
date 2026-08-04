import Image from "next/image";
import styles from "./TodaySession.module.css";

// A quiet signature detail at the very bottom of the landing page, not a
// hero moment -- sits low enough in the page that it lands within the
// mountain watermark's fixed viewport band once someone scrolls that far.
// Deliberately unstyled as a card: no border, no background, so it never
// competes with the Continue card or Explore above it.
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
