"use client";

import { useRef, useState } from "react";
import clinicStyles from "../../clinic.module.css";
import styles from "./BrandPacks.module.css";
import type { AppLayout } from "@/lib/appLayout";

type AppImageKey = "app_logo" | "app_logo_on_dark" | "greeting_image" | "app_icon" | "pacer_mark";

// The images that live with the app settings rather than in the seven
// main slots. Each was previously only settable behind the scenes, so a
// pack could carry them without them ever showing on this page.
const SLOTS: { key: AppImageKey; label: string; format: string; what: string; dark: boolean }[] = [
  {
    key: "app_logo",
    label: "App logo",
    format: "Wide transparent PNG, about 1568 × 504px",
    what: "Shown on the login page under the brand's logo, when the pack has an app of its own.",
    dark: true,
  },
  {
    key: "app_logo_on_dark",
    label: "App logo for dark pages",
    format: "Wide transparent PNG, light coloured",
    what: "Used on dark pages such as the client's record in the clinic. Leave empty to use the app logo everywhere.",
    dark: true,
  },
  {
    key: "greeting_image",
    label: "Greeting picture",
    format: "Square PNG or JPG",
    what: "Shown beside the client's greeting on their home screen, in place of your photo. Leave empty to use the logo mark.",
    dark: false,
  },
  {
    key: "app_icon",
    label: "Home screen icon",
    format: "1024 × 1024px square, no transparency",
    what: "The finished icon on the client's phone. Leave empty and the app draws one from the logo mark and background colour.",
    dark: false,
  },
  {
    key: "pacer_mark",
    label: "Breathing pacer mark",
    format: "Transparent PNG of the mark alone, portrait or square",
    what: "Sits in the middle of the breathing pacer on the Tools tab and swells and settles with the breath. Leave empty to use the logo mark.",
    dark: true,
  },
];

export default function AppImagesEditor({ packId, layout, onChange }: { packId: string; layout: AppLayout; onChange: (next: AppLayout) => void }) {
  return (
    <div className={styles.uploadGrid}>
      {SLOTS.map((slot) => (
        <AppImageSlot
          key={slot.key}
          packId={packId}
          slot={slot}
          url={layout[slot.key]}
          onChange={(url) => onChange({ ...layout, [slot.key]: url })}
        />
      ))}
    </div>
  );
}

function AppImageSlot({
  packId,
  slot,
  url,
  onChange,
}: {
  packId: string;
  slot: (typeof SLOTS)[number];
  url: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`/api/clinic/brand-packs/${packId}/app-image`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.uploadBox}>
      <div className={styles.uploadLabel}>{slot.label} (optional)</div>
      <div className={styles.uploadFormat}>{slot.format}</div>
      <div className={styles.uploadFormat} style={{ marginTop: -6, lineHeight: 1.45 }}>
        {slot.what}
      </div>

      {url && (
        <div className={`${styles.uploadPreviewWrap} ${slot.dark ? styles.uploadPreviewDark : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className={styles.uploadPreview} />
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`${styles.uploadDrop} ${dragOver ? styles.uploadDropOver : ""}`}
      >
        {busy ? "Uploading…" : url ? "Drop a new image here, or click to replace" : "Drag an image here, or click to choose one"}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload(file);
          }}
        />
      </div>

      {url && !busy && (
        <button type="button" className={clinicStyles.buttonSecondary} style={{ marginTop: 8, height: 32, fontSize: 12.5, width: "auto", padding: "0 12px" }} onClick={() => onChange("")}>
          Remove
        </button>
      )}
      {error && <div className={styles.uploadWarning} style={{ color: "var(--crimson-text, var(--crimson))" }}>{error}</div>}
    </div>
  );
}
