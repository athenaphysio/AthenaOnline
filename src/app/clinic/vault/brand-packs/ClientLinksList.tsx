"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import clinicStyles from "../../clinic.module.css";
import styles from "./BrandPacks.module.css";
import { clientLinks } from "@/lib/clientLinks";
import { APP_URL } from "@/lib/appUrl";

const buttonStyle = { width: "auto", padding: "0 14px", height: 34, fontSize: 13 } as const;

// Every link for one pack, each with Copy link and Copy as a message, ready
// to paste into WhatsApp or an email. slug is null for the standard pack.
export default function ClientLinksList({ slug }: { slug: string | null }) {
  const [copied, setCopied] = useState<string | null>(null);
  // The link whose QR code is open full screen, for clients to scan off the screen.
  const [qr, setQr] = useState<{ label: string; url: string; image: string } | null>(null);

  async function showQr(label: string, url: string) {
    try {
      const image = await QRCode.toDataURL(url, { width: 720, margin: 2, errorCorrectionLevel: "M" });
      setQr({ label, url, image });
    } catch {
      setQr(null);
    }
  }

  useEffect(() => {
    if (!qr) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQr(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [qr]);
  // Always the app's own address, whichever address the clinic happens to
  // be open on, so a copied link never carries the old Vercel address.
  const links = clientLinks(APP_URL, slug);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {links.map((l) => (
        <div key={l.kind}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{l.label}</div>
          <p className={styles.sectionNote} style={{ margin: "2px 0 6px" }}>
            {l.note}
          </p>
          <div className={styles.linkBox}>
            <code className={styles.linkUrl}>{l.url}</code>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className={clinicStyles.buttonSecondary} style={buttonStyle} onClick={() => copy(l.url, `${l.kind}-link`)}>
                {copied === `${l.kind}-link` ? "Copied" : "Copy link"}
              </button>
              <button type="button" className={clinicStyles.buttonSecondary} style={buttonStyle} onClick={() => void showQr(l.label, l.url)}>
                QR code
              </button>
              <button type="button" className={clinicStyles.buttonSecondary} style={buttonStyle} onClick={() => copy(l.message, `${l.kind}-message`)}>
                {copied === `${l.kind}-message` ? "Copied" : "Copy as a message"}
              </button>
            </div>
          </div>
        </div>
      ))}

      {qr && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`QR code: ${qr.label}`}
          onClick={() => setQr(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(20, 16, 16, 0.82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: 18,
              padding: "24px 24px 20px",
              width: "min(560px, 100%)",
              maxHeight: "100%",
              overflow: "auto",
              textAlign: "center",
              color: "#1c1c1c",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{qr.label}</div>
            <div style={{ fontSize: 14, color: "#555", marginBottom: 14 }}>Point your phone camera at the code to open the link.</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.image} alt={`QR code for ${qr.label}`} style={{ width: "100%", maxWidth: 480, aspectRatio: "1 / 1", display: "block", margin: "0 auto" }} />
            <div style={{ fontSize: 12, color: "#777", margin: "12px 0 16px", wordBreak: "break-all" }}>{qr.url}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <a
                href={qr.image}
                download={`${qr.label.replace(/[^a-zA-Z0-9]+/g, "_")}_QR.png`}
                className={clinicStyles.buttonSecondary}
                style={{ ...buttonStyle, display: "inline-flex", alignItems: "center", textDecoration: "none" }}
              >
                Save image
              </a>
              <button type="button" className={clinicStyles.button} style={buttonStyle} onClick={() => setQr(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
