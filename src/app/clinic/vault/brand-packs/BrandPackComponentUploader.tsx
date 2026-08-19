"use client";

import { useRef, useState } from "react";
import styles from "./BrandPacks.module.css";
import { warningForDimensions, type BrandPackComponentSpec } from "@/lib/brandPackSpec";

type Props = {
  spec: BrandPackComponentSpec;
  existingUrl: string | null;
  onUpload: (file: File) => Promise<{ url: string; warning: string | null }>;
};

// Reads the file's own pixel dimensions (and, for the two components that
// need it, whether it actually has any transparent pixels) straight in
// the browser, no network round trip -- the warning shows the instant a
// file is picked rather than waiting on the upload to finish.
function checkImageLocally(file: File, spec: BrandPackComponentSpec): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dimensionWarning = warningForDimensions(spec, img.naturalWidth, img.naturalHeight);
      if (dimensionWarning || !spec.requiresTransparency) {
        URL.revokeObjectURL(url);
        resolve(dimensionWarning);
        return;
      }
      // Transparency check: draw to an off-screen canvas and sample the
      // alpha channel -- catches the spec's own documented pitfall, a
      // "transparent" PNG that's actually a flat opaque image.
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let sawTransparency = false;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 255) {
            sawTransparency = true;
            break;
          }
        }
        URL.revokeObjectURL(url);
        resolve(
          sawTransparency
            ? null
            : "This PNG doesn't look like it has real transparency (every pixel is fully opaque) -- check before saving."
        );
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export default function BrandPackComponentUploader({ spec, existingUrl, onUpload }: Props) {
  const [url, setUrl] = useState<string | null>(existingUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    setWarning(await checkImageLocally(file, spec));
    setUploading(true);
    try {
      const result = await onUpload(file);
      setUrl(result.url);
      // The server re-check is the more thorough one (real PNG decode
      // rather than a canvas sample) -- if it found something the quick
      // local check didn't, prefer it.
      if (result.warning) setWarning(result.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={styles.uploadBox}>
      <div className={styles.uploadLabel}>
        {spec.label}
        {spec.optional && " (optional)"}
      </div>
      <div className={styles.uploadFormat}>{spec.formatLabel}</div>

      {url && (
        <div className={styles.uploadPreviewWrap}>
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
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`${styles.uploadDrop} ${dragOver ? styles.uploadDropOver : ""}`}
      >
        {uploading ? "Uploading…" : url ? "Drop a new image here, or click to replace" : "Drag an image here, or click to choose one"}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {warning && <div className={styles.uploadWarning}>{warning}</div>}
      {error && <div className={styles.uploadWarning} style={{ color: "var(--crimson)" }}>{error}</div>}
    </div>
  );
}
