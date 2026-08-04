import { headers } from "next/headers";
import QRCode from "qrcode";
import Image from "next/image";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";

export default async function ClinicQrPage() {
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const url = `${protocol}://${host}/start`;

  const qrDataUrl = await QRCode.toDataURL(url, { width: 480, margin: 2 });

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Patient sign-up</h1>
        <p className={styles.subheading}>
          Show this on your phone, or print it for the clinic. Scanning it — or opening the link
          below — takes a new patient straight to account setup.
        </p>

        <div style={{ textAlign: "center", margin: "8px 0 20px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="QR code linking to the patient sign-up page"
            width={280}
            height={280}
            style={{ border: "1px solid var(--clinic-on-canvas-muted)", borderRadius: 14 }}
          />
        </div>

        <div className={styles.card} style={{ textAlign: "center" }}>
          <div className={styles.smallLabel}>Plain link</div>
          <div className={styles.shareLinkText} style={{ color: "var(--ink)" }}>
            {url}
          </div>
        </div>
      </div>
    </div>
  );
}
