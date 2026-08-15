"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  url: string | null;
  programmeId: string;
  className?: string;
};

// The patient's own goal picture (see 0066_programme_goal_image.sql).
// Doubles as the upload control: tapping it, in either state, opens the
// phone's photo picker and replaces whatever is showing. Until a client
// or David sets a real one, the crimson mountain image is the on-brand
// default, not a plain placeholder.
export default function GoalImage({ url, programmeId, className }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("programme_id", programmeId);
      body.set("file", file);
      const res = await fetch("/api/session/goal-image", { method: "POST", body });
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
    <div
      onClick={() => inputRef.current?.click()}
      className={className}
      style={{
        position: "relative",
        cursor: "pointer",
        backgroundImage: url ? `url(${url})` : "url(/patient/goal-placeholder-default.jpg)",
        backgroundSize: "cover",
        backgroundPosition: url ? "center" : "center 65%",
      }}
    >
      {!url && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 6,
            fontSize: 10.5,
            fontWeight: 600,
            lineHeight: 1.25,
            color: "#fff",
            textShadow: "0 1px 3px rgba(0,0,0,0.55)",
          }}
        >
          Your Goal Picture
        </div>
      )}
      {uploading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 600,
            color: "#fff",
            background: "rgba(28, 28, 28, 0.55)",
          }}
        >
          Uploading…
        </div>
      )}
      {error && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            fontSize: 10.5,
            color: "var(--crimson, #9b1c1c)",
            width: 140,
          }}
        >
          {error}
        </div>
      )}
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
  );
}
