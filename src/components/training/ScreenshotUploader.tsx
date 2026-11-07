"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// A client sends a screenshot of a PM5, watch or app screen. It goes to Dr
// David Silver PhD to read; no numbers are taken from it automatically.
export default function ScreenshotUploader({ buttonClass }: { buttonClass: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const body = new FormData();
    body.append("file", file, file.name);
    body.append("note", note);
    try {
      const res = await fetch("/api/session/training-data/screenshot", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That picture didn't upload.");
      setMessage("Sent. Dr David Silver PhD will see it on your record.");
      setFile(null);
      setNote("");
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const box = { width: "100%", padding: "9px 11px", borderRadius: 10, border: "1px solid rgba(127,127,127,0.35)", font: "inherit", fontSize: 14, background: "transparent", color: "inherit", boxSizing: "border-box" as const };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input ref={input} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 14 }} />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What is this from? (optional)" style={box} />
      <button type="button" className={buttonClass} disabled={!file || busy} onClick={send}>
        {busy ? "Sending…" : "Send the picture"}
      </button>
      {message && <p style={{ margin: 0, fontSize: 14 }}>{message}</p>}
      {error && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{error}</p>}
    </div>
  );
}
