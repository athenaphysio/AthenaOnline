"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import shopStyles from "../../shop/shop.module.css";

export default function WorkoutUploader() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const body = new FormData();
    body.append("file", file, file.name);
    body.append("note", note);
    try {
      const res = await fetch("/api/session/workouts", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That file didn't upload.");
      setMessage(`Added: ${data.workout.sportLabel.toLowerCase()} on ${new Date(data.workout.startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`);
      setFile(null);
      setNote("");
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That file didn't upload.");
    } finally {
      setBusy(false);
    }
  }

  const box = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(127,127,127,0.35)", font: "inherit", fontSize: 14, background: "transparent", color: "inherit" } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        ref={input}
        type="file"
        accept=".fit,.FIT,.zip,application/zip,application/octet-stream"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setMessage(null);
          setError(null);
        }}
        style={{ fontSize: 14 }}
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Anything worth knowing about this session? (optional)"
        style={box}
      />
      <button type="button" className={shopStyles.buyButton} disabled={!file || busy} onClick={upload}>
        {busy ? "Reading the file…" : "Upload"}
      </button>
      {message && <p style={{ margin: 0, fontSize: 14 }}>{message}</p>}
      {error && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{error}</p>}
    </div>
  );
}
