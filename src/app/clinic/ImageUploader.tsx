"use client";

import { useRef, useState } from "react";
import styles from "./clinic.module.css";

type Props = {
  existingUrl: string | null;
  onUpload: (file: File) => Promise<string>;
};

// Drag-and-drop or click-to-choose, same "upload immediately, parent hands
// back the real URL" contract as AudioRecorder -- swap the modality, not
// the shape.
export default function ImageUploader({ existingUrl, onUpload }: Props) {
  const [savedUrl, setSavedUrl] = useState<string | null>(existingUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const url = await onUpload(file);
      setSavedUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {savedUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={savedUrl}
          alt=""
          style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, marginBottom: 10 }}
        />
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
        style={{
          border: `2px dashed ${dragOver ? "var(--crimson)" : "var(--mist)"}`,
          borderRadius: 10,
          padding: "22px 16px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? "var(--clinic-box-recessed)" : "var(--clinic-box)",
          fontSize: 13,
          color: "var(--graphite)",
        }}
      >
        {uploading
          ? "Uploading…"
          : savedUrl
            ? "Drop a new image here, or click to replace"
            : "Drag an image here, or click to choose one"}
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
      {error && (
        <div className={styles.error} style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}
