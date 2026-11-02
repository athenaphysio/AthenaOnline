"use client";

import { useEffect, useRef, useState } from "react";
import { flowSeconds, formatDuration, type FlowMove } from "@/lib/flows";
import styles from "../../screens/Screens.module.css";

// The client's follow along for a Tools practice. A short countdown to get
// settled, then each move in turn with its cue, a ring showing time left in
// the move, and a pacer that swells on the breath in and settles on the
// breath out. A soft tone marks each change, and can be switched off.
// Nothing is logged: this is a resource, not part of the programme.

const PRE_SECONDS = 5;
const CIRC = 2 * Math.PI * 46;

export default function ToolPlayer({ moves, withVideo }: { moves: FlowMove[]; withVideo: boolean }) {
  const total = flowSeconds(moves);
  const [idx, setIdx] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [preroll, setPreroll] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [sound, setSound] = useState(true);

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
    if (cur.breathSeconds > 0) {
      const ph = ((elapsed / 1000) % cur.breathSeconds) / cur.breathSeconds;
      scale = 0.62 + 0.38 * (0.5 - 0.5 * Math.cos(2 * Math.PI * ph));
      breath = ph < 0.5 ? "Breathe in" : "Breathe out";
    }
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

  return (
    <div className={styles.card} style={{ textAlign: "center" }}>
      <div style={{ fontSize: 12.5, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--muted)", fontWeight: 600 }}>{heading}</div>

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
        <button type="button" style={{ ...btn, background: "var(--crimson)", color: "#fff", border: "none", minWidth: 110 }} onClick={startPause}>
          {running ? "Pause" : idx >= 0 || inPre ? "Carry on" : finished ? "Start again" : "Start"}
        </button>
        {idx >= 0 && (
          <button type="button" style={btn} onClick={() => goTo(idx + 1)}>
            Next
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 12, fontSize: 13 }}>
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
