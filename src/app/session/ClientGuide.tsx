"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";
import LoginHero from "../start/LoginHero";
import PageBanner from "@/components/PageBanner";
import BrandPackCookie from "@/components/BrandPackCookie";
import GuideBody from "@/components/GuideBody";
import { loginRootProps } from "../start/loginRootProps";
import styles from "../start/start.module.css";

// A brand pack's client guide, on a page of its own in the client's brand.
// "first" is the version shown before anything else in the app opens: it
// ends with the button that confirms the client has read it. "reread" is
// the same guide opened again later from the home screen.
export default function ClientGuide({
  brand,
  packId,
  title,
  body,
  firstName,
  mode,
}: {
  brand: ResolvedBrandPack | null;
  packId: string;
  title: string;
  body: string;
  firstName: string;
  mode: "first" | "reread";
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const branded = brand && !brand.isAllDefault;

  async function confirmRead() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/session/guide-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("That did not save. Please check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <div {...loginRootProps(branded ? brand : null, styles)}>
      {branded && <BrandPackCookie packId={brand.id} />}
      {branded ? <LoginHero brand={brand} /> : <PageBanner />}
      <div className={branded ? `${styles.inner} ${styles.innerBranded}` : styles.inner} style={{ maxWidth: 620 }}>
        <h1 className={styles.heading}>{title}</h1>
        {mode === "first" && (
          <p className={styles.subheading}>
            {firstName ? `${firstName}, before` : "Before"} your programme opens, please read this guide. It takes about ten
            minutes, and it explains why your programme is built the way it is.
          </p>
        )}

        <GuideBody source={body} />

        <div style={{ marginTop: 28 }}>
          {mode === "first" ? (
            <>
              <button type="button" className={styles.button} disabled={saving} onClick={confirmRead}>
                {saving ? "Opening your programme…" : "I have read this guide"}
              </button>
              <p className={styles.subheading} style={{ marginTop: 10, fontSize: 13 }}>
                You can come back to this guide at any time from your home screen.
              </p>
              {error && <p style={{ fontSize: 13.5, marginTop: 8 }}>{error}</p>}
            </>
          ) : (
            <Link href="/session" className={styles.button} style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              Back to your programme
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
