"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  className?: string;
  // Clinic-only: shows an "Upload"/"Replace" control beneath the image
  // (or in place of it, before one exists) that saves straight to
  // app_assets via /api/clinic/assets. Omit on the patient-facing side.
  editable?: boolean;
};

// David's own labelled photo of the PM5 monitor -- shown alongside any
// button sequence so a client can see which physical button is A, B, C, D
// or E, since they aren't labelled on the machine itself. Self-fetching
// (same pattern as NotificationBell) rather than threaded through props,
// since it's one small, rarely-changing, site-wide image rather than
// per-item data. Renders nothing until David has uploaded his own copy --
// no placeholder, no broken-image state -- unless editable, in which case
// an empty state shows the upload control itself.
export default function Pm5ButtonKeyImage({ className, editable }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    fetch("/api/assets/cardio_pm5_button_key")
      .then((r) => r.json())
      .then((d) => setUrl(d.url ?? null))
      .catch(() => {});
  }

  useEffect(load, []);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/clinic/assets/cardio_pm5_button_key", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) setUrl(data.url);
    } finally {
      setUploading(false);
    }
  }

  if (!url && !editable) return null;

  return (
    <div>
      {url ? (
        <img src={url} alt="PM5 monitor with the five buttons labelled A to E" className={className} />
      ) : (
        editable && (
          <div
            className={className}
            style={{
              aspectRatio: "4 / 3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 10,
              background:
                "repeating-linear-gradient(135deg, var(--clinic-box, #f2ede4), var(--clinic-box, #f2ede4) 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 20px)",
              border: "1px dashed var(--mist, #ccc)",
              fontSize: 12,
              color: "var(--graphite, #888)",
            }}
          >
            PM5 key image placeholder, David to supply
          </div>
        )
      )}
      {editable && (
        <div style={{ marginTop: url ? 6 : 0 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading..." : url ? "Replace image" : "Upload PM5 key image"}
          </button>
        </div>
      )}
    </div>
  );
}
