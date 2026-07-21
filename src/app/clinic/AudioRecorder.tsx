"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./clinic.module.css";

type Status = "idle" | "recording" | "review" | "saving" | "error";

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

export default function AudioRecorder({
  existingUrl,
  onUpload,
}: {
  existingUrl: string | null;
  onUpload: (blob: Blob) => Promise<string>;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(existingUrl);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        setStatus("review");
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      recorderRef.current = recorder;
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      setStatus("recording");
    } catch {
      setError("Couldn't access your microphone. Check your browser's permission for this site.");
      setStatus("error");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  }

  function reRecord() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    setStatus("idle");
  }

  async function save() {
    if (!blobRef.current) return;
    setStatus("saving");
    setError(null);
    try {
      const url = await onUpload(blobRef.current);
      setSavedUrl(url);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      blobRef.current = null;
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setStatus("error");
    }
  }

  return (
    <div>
      {status === "idle" && (
        <>
          {savedUrl && (
            <audio controls src={savedUrl} style={{ width: "100%", marginBottom: 10 }} />
          )}
          <button type="button" className={styles.buttonSecondary} onClick={startRecording}>
            {savedUrl ? "Re-record" : "Record"}
          </button>
        </>
      )}

      {status === "recording" && (
        <div className={styles.actions}>
          <div style={{ fontSize: 14, color: "var(--crimson-dark)", fontWeight: 500 }}>
            ● Recording… {elapsed}s
          </div>
          <button type="button" className={styles.button} onClick={stopRecording}>
            Stop
          </button>
        </div>
      )}

      {status === "review" && previewUrl && (
        <div className={styles.actions}>
          <audio controls src={previewUrl} style={{ width: "100%" }} />
          <button type="button" className={styles.button} onClick={save}>
            Save
          </button>
          <button type="button" className={styles.buttonSecondary} onClick={reRecord}>
            Re-record
          </button>
        </div>
      )}

      {status === "saving" && <div className={styles.notice}>Saving…</div>}

      {status === "error" && (
        <>
          {error && <div className={styles.error}>{error}</div>}
          <button type="button" className={styles.buttonSecondary} onClick={reRecord}>
            Try again
          </button>
        </>
      )}
    </div>
  );
}
