"use client";

import clinicStyles from "../../clinic.module.css";
import styles from "./BrandPacks.module.css";
import { linkSlug } from "@/lib/appLayout";
import { APP_URL } from "@/lib/appUrl";
import ClientLinksList from "./ClientLinksList";

// The pack's own links for clients, to send by WhatsApp or email: the app
// login, registration, registration followed by the Programme intake form,
// and the intake form on its own. Each opens in this pack's look, saves the
// pack's icon if the client adds the app to their home screen, and the
// link's preview carries the pack's name and artwork.
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
  const origin = APP_URL;
  const slug = linkSlug(linkName) || linkSlug(packName);

  return (
    <div className={clinicStyles.field} style={{ marginTop: 18 }}>
      <label className={clinicStyles.label}>Client links</label>
      <p className={styles.sectionNote} style={{ marginBottom: 8 }}>
        {isDefault
          ? "The standard links, for clients on the usual Athena look."
          : "Send these to a client by WhatsApp or email. Each opens in this pack's look, gives them this pack's icon on their home screen, and its preview shows this pack's name and artwork."}
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
      <ClientLinksList slug={isDefault ? null : slug} />
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
