"use client";

import { useState } from "react";
import clinicStyles from "../../clinic.module.css";
import styles from "./BrandPacks.module.css";
import { linkSlug } from "@/lib/appLayout";
import { APP_URL } from "@/lib/appUrl";

// The pack's own link for clients, to send by WhatsApp or email. Opening it
// shows the login page in this pack's look, saves the pack's icon if the
// client adds the app to their home screen, and the link's preview carries
// the pack's name and artwork.
export default function ClientLinkField({
  linkName,
  packName,
  isDefault,
  onChange,
}: {
  linkName: string;
  packName: string;
  isDefault: boolean;
  onChange: (next: string) => void;
}) {
  // Always the app's own address, whichever address the clinic happens to
  // be open on, so a copied link never carries the old Vercel address.
  const origin = APP_URL;
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  const slug = linkSlug(linkName) || linkSlug(packName);
  const url = isDefault ? `${origin}/start` : `${origin}/join/${slug}`;
  const message = `Here is your link to the app. Open it on your phone and log in, then add it to your home screen so it is always to hand: ${url}`;

  async function copy(text: string, which: "link" | "message") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className={clinicStyles.field} style={{ marginTop: 18 }}>
      <label className={clinicStyles.label}>Client link</label>
      <p className={styles.sectionNote} style={{ marginBottom: 8 }}>
        {isDefault
          ? "The standard login link, for clients on the usual Athena look."
          : "Send this to a client by WhatsApp or email. It opens the login page in this pack's look, gives them this pack's icon on their home screen, and its preview shows this pack's name and artwork."}
      </p>
      {!isDefault && (
        <div className={styles.linkNameRow}>
          <span className={styles.linkPrefix}>{origin}/join/</span>
          <input
            className={styles.colorHexInput}
            value={linkName}
            onChange={(e) => onChange(e.target.value)}
            placeholder={linkSlug(packName)}
            aria-label="Link name"
          />
        </div>
      )}
      <div className={styles.linkBox}>
        <code className={styles.linkUrl}>{url}</code>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className={clinicStyles.buttonSecondary} style={{ width: "auto", padding: "0 14px", height: 34, fontSize: 13 }} onClick={() => copy(url, "link")}>
            {copied === "link" ? "Copied" : "Copy link"}
          </button>
          <button type="button" className={clinicStyles.buttonSecondary} style={{ width: "auto", padding: "0 14px", height: 34, fontSize: 13 }} onClick={() => copy(message, "message")}>
            {copied === "message" ? "Copied" : "Copy as a message"}
          </button>
        </div>
      </div>
      {!isDefault && linkSlug(linkName) !== linkName.trim() && linkName.trim() !== "" && (
        <p className={styles.uploadWarning}>Spaces and symbols become hyphens, so this saves as &ldquo;{linkSlug(linkName)}&rdquo;.</p>
      )}
      {!isDefault && (
        <p className={styles.uploadWarning} style={{ color: "var(--muted)" }}>
          A new or changed link name works once you press Save pack. Links you have already sent with the old name stop
          showing this pack, so it is best to choose a name once and keep it.
        </p>
      )}
    </div>
  );
}
