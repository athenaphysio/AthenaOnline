"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  programmeId: string;
  /** The card or session this note is about, when there is one. */
  workoutId?: string | null;
  weekNumber?: number | null;
  dayOfWeek?: number | null;
  /** What the client is looking at, e.g. "Long steady row, 45 min". */
  contextTitle: string;
};

type Phase = "idle" | "recording" | "sending" | "done" | "error";

const MAX_SECONDS = 120;

// Asked once per page load, shared by every button on the page.
let enabledPromise: Promise<boolean> | null = null;
function checkEnabled(): Promise<boolean> {
  if (!enabledPromise) {
    enabledPromise = fetch("/api/session/voice-notes")
      .then((r) => r.json())
      .then((d) => d.enabled === true)
      .catch(() => false);
  }
  return enabledPromise;
}

function pickMimeType(): { mimeType: string; filename: string } {
  const options = [
    { mimeType: "audio/webm;codecs=opus", filename: "note.webm" },
    { mimeType: "audio/webm", filename: "note.webm" },
    { mimeType: "audio/mp4", filename: "note.mp4" },
  ];
  for (const o of options) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(o.mimeType)) return o;
  }
  return { mimeType: "", filename: "note.webm" };
}

// "Tell David how that went": one optional button after any practice. The
// client talks, the note becomes text, and the text reaches their record.
// Never required and never nags; nothing shows at all unless David has
// switched voice notes on for this client.
export default function VoiceNoteButton({ programmeId, workoutId, weekNumber, dayOfWeek, contextTitle }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(0);
  const formatRef = useRef(pickMimeType());

  useEffect(() => {
    let live = true;
    checkEnabled().then((v) => {
      if (live) setEnabled(v);
    });
    return () => {
      live = false;
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (!enabled) return null;

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const fmt = formatRef.current;
      const recorder = fmt.mimeType ? new MediaRecorder(stream, { mimeType: fmt.mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        send();
      };
      recorderRef.current = recorder;
      recorder.start();
      startedRef.current = Date.now();
      setSeconds(0);
      setPhase("recording");
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedRef.current) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) stop();
      }, 250);
    } catch {
      setError("The microphone couldn't be opened. Check that this app is allowed to use it in your phone's settings, or type your note instead.");
      setPhase("error");
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  async function send() {
    setPhase("sending");
    const type = recorderRef.current?.mimeType || formatRef.current.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type });
    const filename = type.includes("mp4") ? "note.mp4" : "note.webm";
    const body = new FormData();
    body.append("audio", blob, filename);
    body.append("filename", filename);
    body.append("programme_id", programmeId);
    if (workoutId) body.append("workout_id", workoutId);
    if (weekNumber) body.append("week_number", String(weekNumber));
    if (dayOfWeek) body.append("day_of_week", String(dayOfWeek));
    body.append("context_title", contextTitle);
    body.append("duration_seconds", String(Math.round((Date.now() - startedRef.current) / 1000)));
    try {
      const res = await fetch("/api/session/voice-notes", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That note didn't send.");
      setTranscript(data.transcript ?? "");
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That note didn't send.");
      setPhase("error");
    }
  }

  const box = { marginTop: 12, padding: "12px 14px", background: "var(--mist)", borderRadius: 10 } as const;
  const button = {
    border: "1px solid var(--stone)",
    background: "var(--input-bg, #fff)",
    color: "var(--ink, inherit)",
    borderRadius: 10,
    padding: "9px 14px",
    fontSize: 13.5,
    cursor: "pointer",
  } as const;

  if (phase === "done") {
    return (
      <div style={box}>
        <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 6 }}>Sent to David</div>
        {transcript && <p style={{ fontSize: 13, margin: "0 0 8px", lineHeight: 1.5, fontStyle: "italic" }}>{transcript}</p>}
        <button type="button" style={button} onClick={() => setPhase("idle")}>
          Add another
        </button>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 4 }}>Tell David how that went</div>
      <p style={{ fontSize: 12.5, margin: "0 0 10px", lineHeight: 1.5, color: "var(--graphite)" }}>
        How did it feel, what did you notice, and was there anything that worried you? Up to two minutes, in your own words.
      </p>
      {phase === "recording" ? (
        <button type="button" style={{ ...button, borderColor: "var(--crimson)" }} onClick={stop}>
          Stop and send ({Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")})
        </button>
      ) : (
        <button type="button" style={button} disabled={phase === "sending"} onClick={start}>
          {phase === "sending" ? "Turning it into text…" : "Record a voice note"}
        </button>
      )}
      {error && <p style={{ fontSize: 12.5, margin: "8px 0 0", lineHeight: 1.5 }}>{error}</p>}
      <p style={{ fontSize: 11.5, margin: "10px 0 0", lineHeight: 1.5, color: "var(--graphite)" }}>
        David reads these regularly, though not straight away. For anything urgent, send him a message or call the clinic.
      </p>
    </div>
  );
}
