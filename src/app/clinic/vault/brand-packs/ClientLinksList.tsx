"use client";

import { useState } from "react";
import clinicStyles from "../../clinic.module.css";
import styles from "./BrandPacks.module.css";
import { clientLinks } from "@/lib/clientLinks";
import { APP_URL } from "@/lib/appUrl";

const buttonStyle = { width: "auto", padding: "0 14px", height: 34, fontSize: 13 } as const;

// Every link for one pack, each with Copy link and Copy as a message, ready
// to paste into WhatsApp or an email. slug is null for the standard pack.
export default function ClientLinksList({ slug }: { slug: string | null }) {
  const [copied, setCopied] = useState<string | null>(null);
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
              <button type="button" className={clinicStyles.buttonSecondary} style={buttonStyle} onClick={() => copy(l.message, `${l.kind}-message`)}>
                {copied === `${l.kind}-message` ? "Copied" : "Copy as a message"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
