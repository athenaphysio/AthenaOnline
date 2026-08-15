"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

type Props = {
  patientId: string;
  programmeId: string;
  existingUrl: string | null;
};

// David setting a client's goal picture on their behalf (Phase 4 -- see
// the goal picture audit). Same "click or drop, upload immediately"
// shape as ImageUploader.tsx, but this one refreshes the page rather
// than handing back a URL, since the underlying file lives in a private
// bucket behind a signed URL that's only good for a few minutes.
export default function GoalImageUploader({ patientId, programmeId, existingUrl }: Props) {
  const router = useRouter();
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
      const body = new FormData();
      body.set("programme_id", programmeId);
      body.set("file", file);
      const res = await fetch(`/api/clinic/patients/${patientId}/goal-image`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Goal picture</div>
      {existingUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={existingUrl}
          alt=""
          style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 10, marginBottom: 10 }}
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
          padding: "18px 14px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? "var(--clinic-box-recessed)" : "var(--clinic-box)",
          fontSize: 13,
          color: "var(--graphite)",
        }}
      >
        {uploading
          ? "Uploading…"
          : existingUrl
            ? "Drop a new photo here, or click to replace"
            : "Drag a photo here, or click to choose one"}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <div className={clinicStyles.error} style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}
