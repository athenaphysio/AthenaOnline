"use client";

import { useEffect, useRef, useState } from "react";
import { breathAt, flowSeconds, formatDuration, type FlowMove } from "@/lib/flows";
import styles from "../../screens/Screens.module.css";

// The client's follow along for a Tools practice. A short countdown to get
// settled, then each move in turn with its cue, a ring showing time left in
// the move, and a pacer that swells on the breath in and settles on the
// breath out. A soft tone marks each change, and can be switched off.
// Nothing is logged: this is a resource, not part of the programme.

const PRE_SECONDS = 5;
const CIRC = 2 * Math.PI * 46;
const RING = 2 * Math.PI * 48;

// Low light: while a practice runs, the screen goes nearly black with only a
// faint pacer and the cue in dim text, for bedtime and the middle of the
// night. The screen stays on so the timer and tones keep going; one tap
// brings the full screen back. Recovery practices start in low light.
export default function ToolPlayer({
  moves,
  withVideo,
  lowLight = false,
  mark = "",
}: {
  moves: FlowMove[];
  withVideo: boolean;
  lowLight?: boolean;
  /** The brand pack's mark, drawn in the middle of the pacer. */
  mark?: string;
}) {
  const [dim, setDim] = useState(lowLight);
  const total = flowSeconds(moves);
  const [idx, setIdx] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [preroll, setPreroll] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [sound, setSound] = useState(!lowLight);

  const audio = useRef<AudioContext | null>(null);
  const state = useRef({ idx, elapsed, preroll, sound });
  useEffect(() => {
    state.current = { idx, elapsed, preroll, sound };
  });

  function tone(freq: number, ms: number) {
    if (!state.current.sound) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audio.current = audio.current ?? new Ctx();
      const a = audio.current;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      o.connect(g);
      g.connect(a.destination);
      g.gain.setValueAtTime(0.0001, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, a.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + ms / 1000);
      o.start();
      o.stop(a.currentTime + ms / 1000 + 0.02);
    } catch {
      // Sound is a nicety; the practice works without it.
    }
  }

  function goTo(i: number) {
    if (i >= moves.length) {
      setRunning(false);
      setIdx(-1);
      setElapsed(0);
      setPreroll(0);
      setFinished(true);
      tone(528, 600);
      return;
    }
    const next = Math.max(0, i);
    state.current = { ...state.current, idx: next, elapsed: 0, preroll: 0 };
    setIdx(next);
    setElapsed(0);
    setPreroll(0);
    tone(440, 300);
  }

  const handlers = useRef({ goTo });
  useEffect(() => {
    handlers.current = { goTo };
  });

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      const cur = state.current;
      if (cur.preroll > 0) {
        const left = cur.preroll - dt;
        if (left <= 0) handlers.current.goTo(0);
        else {
          state.current = { ...cur, preroll: left };
          setPreroll(left);
        }
      } else if (cur.idx >= 0) {
        const next = cur.elapsed + dt;
        if (next >= moves[cur.idx].seconds * 1000) handlers.current.goTo(cur.idx + 1);
        else {
          state.current = { ...cur, elapsed: next };
          setElapsed(next);
        }
      }
    }, 100);
    return () => clearInterval(timer);
  }, [running, moves]);

  // Keep the phone's screen on while the practice runs.
  useEffect(() => {
    if (!running) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    navigator.wakeLock
      ?.request("screen")
      .then((w) => {
        if (cancelled) w.release();
        else lock = w;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      lock?.release().catch(() => {});
    };
  }, [running]);

  function startPause() {
    if (running) {
      setRunning(false);
      return;
    }
    setFinished(false);
    if (idx < 0 && preroll === 0) setPreroll(PRE_SECONDS * 1000);
    setRunning(true);
  }

  function restart() {
    setRunning(false);
    setIdx(-1);
    setElapsed(0);
    setPreroll(0);
    setFinished(false);
  }

  const inPre = preroll > 0;
  const cur = idx >= 0 ? moves[idx] : null;
  const shown = inPre ? moves[0] : cur;
  const upcoming = inPre ? null : idx >= 0 ? moves[idx + 1] : moves[0];

  let heading = withVideo ? "Or follow along with the timer" : "Follow along";
  let count = formatDuration(total);
  let progress = 0;
  let scale = 1;
  // How full the breath is, 0 to 1: drives the halo, the disc and the mark.
  let fill = 0.5;
  let breath = "";
  if (finished) heading = "Practice complete";
  if (inPre) {
    heading = "Get settled";
    count = String(Math.ceil(preroll / 1000));
    progress = 1 - preroll / (PRE_SECONDS * 1000);
  } else if (cur) {
    heading = `${idx + 1} of ${moves.length}`;
    count = formatDuration(Math.ceil(cur.seconds - elapsed / 1000));
    progress = elapsed / 1000 / cur.seconds;
    const b = breathAt(cur, elapsed / 1000);
    if (b) {
      scale = 0.62 + 0.38 * b.fill;
      fill = b.fill;
      breath = b.word;
    } else if (running) {
      // No set pattern: a slow, gentle swell so the pacer still feels alive.
      fill = 0.5 + 0.12 * Math.sin(((elapsed / 1000) * 2 * Math.PI) / 7);
    }
  } else if (inPre) {
    fill = 0.5 + 0.12 * Math.sin(((preroll / 1000) * 2 * Math.PI) / 7);
  }

  const btn: React.CSSProperties = {
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--charcoal)",
    borderRadius: 999,
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };

  const dimmed = dim && (running || inPre) && !finished;

  return (
    <div className={styles.card} style={{ textAlign: "center" }}>
      {dimmed && (
        <button
          type="button"
          onClick={() => setDim(false)}
          aria-label="Low light is on. Tap to show the full screen."
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "#000",
            border: "none",
            display: "grid",
            placeItems: "center",
            alignContent: "center",
            gap: 18,
            padding: 32,
            cursor: "pointer",
          }}
        >
          {mark ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mark}
              alt=""
              aria-hidden="true"
              style={{ height: 110, width: "auto", opacity: 0.16, transform: `scale(${0.8 + 0.2 * fill})`, transition: "transform 0.12s linear" }}
            />
          ) : (
            <svg viewBox="0 0 100 100" width="160" height="160" aria-hidden="true">
              <circle cx="50" cy="50" r={34 * scale} fill="#ffffff" opacity={0.07} />
            </svg>
          )}
          <span style={{ color: "rgba(255,255,255,0.32)", fontSize: 15, lineHeight: 1.6, maxWidth: 300 }}>
            {breath || shown?.name}
            {shown?.cue ? <span style={{ display: "block", fontSize: 13.5, marginTop: 8 }}>{shown.cue}</span> : null}
          </span>
        </button>
      )}
      <div style={{ fontSize: 12.5, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--muted)", fontWeight: 600 }}>{heading}</div>

      {mark ? (
        <>
          <BreathOrb mark={mark} fill={fill} progress={progress} />
          <div style={{ fontSize: 22, fontWeight: 600, color: "var(--charcoal)", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>{count}</div>
          <div style={{ fontSize: 13.5, color: "var(--crimson)", fontWeight: 600, minHeight: 20, letterSpacing: 0.4 }}>{breath}</div>
        </>
      ) : (
        <svg viewBox="0 0 100 100" width="190" height="190" style={{ display: "block", margin: "10px auto" }} aria-hidden="true">
          <circle cx="50" cy="50" r="46" fill="none" stroke="var(--border)" strokeWidth="3" />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--crimson)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - Math.min(1, progress))}
            transform="rotate(-90 50 50)"
          />
          <circle cx="50" cy="50" r={34 * scale} fill="var(--crimson)" opacity={0.14} />
          <text x="50" y={breath ? 50 : 55} textAnchor="middle" style={{ fontSize: 15, fontWeight: 600, fill: "var(--charcoal)" }}>
            {count}
          </text>
          {breath && (
            <text x="50" y="63" textAnchor="middle" style={{ fontSize: 6.5, fill: "var(--muted)" }}>
              {breath}
            </text>
          )}
        </svg>
      )}

      <div aria-live="polite">
        {finished ? (
          <p className={styles.muted} style={{ fontSize: 15 }}>
            That is the practice done. Take a moment to notice what has changed since you started.
          </p>
        ) : (
          shown && (
            <>
              <h3 className={styles.cardTitle} style={{ fontSize: 17 }}>
                {shown.name}
                {shown.side && shown.side !== "Both" ? `, ${shown.side.toLowerCase()} side` : shown.side === "Both" ? ", both sides" : ""}
              </h3>
              {shown.cue && <p className={styles.muted} style={{ fontSize: 14.5 }}>{shown.cue}</p>}
            </>
          )
        )}
        {!finished && upcoming && idx >= 0 && <p className={styles.toolMeta}>Next: {upcoming.name}</p>}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 14 }}>
        {idx > 0 && (
          <button type="button" style={btn} onClick={() => goTo(idx - 1)}>
            Back
          </button>
        )}
        <button type="button" style={{ ...btn, background: "var(--crimson)", color: "var(--on-crimson, #fff)", border: "none", minWidth: 110 }} onClick={startPause}>
          {running ? "Pause" : idx >= 0 || inPre ? "Carry on" : finished ? "Start again" : "Start"}
        </button>
        {idx >= 0 && (
          <button type="button" style={btn} onClick={() => goTo(idx + 1)}>
            Next
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 12, fontSize: 13 }}>
        <button type="button" onClick={() => setDim((d) => !d)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>
          Low light {dim ? "on" : "off"}
        </button>
        <button type="button" onClick={() => setSound((s) => !s)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>
          Sound {sound ? "on" : "off"}
        </button>
        {(idx >= 0 || inPre) && (
          <button type="button" onClick={restart} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>
            Start from the beginning
          </button>
        )}
      </div>
    </div>
  );
}

// The pacer in the pack's own look: a soft halo and a disc in the pack's
// colours that swell on the breath in and settle on the breath out, the
// pack's mark breathing in the middle, and a thin ring for time left in
// the move.
function BreathOrb({ mark, fill, progress }: { mark: string; fill: number; progress: number }) {
  const ease = "transform 0.12s linear, opacity 0.12s linear";
  return (
    <div style={{ position: "relative", width: 236, height: 236, margin: "12px auto 6px", display: "grid", placeItems: "center" }} aria-hidden="true">
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--crimson) 34%, transparent) 0%, color-mix(in srgb, var(--crimson) 10%, transparent) 46%, transparent 70%)",
          transform: `scale(${0.7 + 0.5 * fill})`,
          opacity: 0.35 + 0.65 * fill,
          transition: ease,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "12%",
          borderRadius: "50%",
          border: "2px solid color-mix(in srgb, var(--crimson) 85%, transparent)",
          background: "radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--crimson) 10%, var(--surface)) 0%, var(--sand) 78%)",
          boxShadow: "0 0 36px color-mix(in srgb, var(--crimson) 32%, transparent)",
          transform: `scale(${0.62 + 0.38 * fill})`,
          transition: ease,
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mark}
        alt=""
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          height: 92,
          maxWidth: 92,
          width: "auto",
          objectFit: "contain",
          marginTop: -46,
          translate: "-50% 0",
          filter: "drop-shadow(0 0 12px color-mix(in srgb, var(--crimson) 55%, transparent))",
          transform: `scale(${0.8 + 0.2 * fill})`,
          transition: ease,
        }}
      />
      <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <circle cx="50" cy="50" r="48" fill="none" stroke="var(--border)" strokeWidth="1.2" opacity={0.6} />
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="var(--crimson)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeDasharray={RING}
          strokeDashoffset={RING * (1 - Math.min(1, progress))}
          transform="rotate(-90 50 50)"
        />
      </svg>
    </div>
  );
}
