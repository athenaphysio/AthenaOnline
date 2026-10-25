"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { flowSeconds, formatDuration, type Flow } from "@/lib/flows";
import s from "../../Flows.module.css";

// The timed cue screen David watches while filming a follow along flow.
// Put it on a tablet or laptop right beside the lens. A five second
// countdown gets him into position, each move counts down with a beep for
// the last three seconds, and the breath pacer swells and settles.

const PRE_SECONDS = 5;
const CIRC = 2 * Math.PI * 46;

export default function FlowPrompter({ flow }: { flow: Flow }) {
  const moves = flow.moves;
  const total = flowSeconds(moves);

  const [idx, setIdx] = useState(-1); // -1 means not started
  const [elapsed, setElapsed] = useState(0); // ms into the current move
  const [preroll, setPreroll] = useState(0); // ms left in the get ready countdown
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [sound, setSound] = useState(true);
  const [mirror, setMirror] = useState(false);

  const audioRef = useRef<AudioContext | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  // The ticking interval reads the latest values through this ref, refreshed
  // after every render, so it does not have to restart on each tick.
  const state = useRef({ idx, elapsed, preroll, sound });
  useEffect(() => {
    state.current = { idx, elapsed, preroll, sound };
  });

  function beep(freq: number, ms: number) {
    if (!state.current.sound) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioRef.current = audioRef.current ?? new Ctx();
      const a = audioRef.current;
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.value = freq;
      o.connect(g);
      g.connect(a.destination);
      g.gain.setValueAtTime(0.0001, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, a.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + ms / 1000);
      o.start();
      o.stop(a.currentTime + ms / 1000 + 0.02);
    } catch {
      // Sound is a nicety; the screen still works without it.
    }
  }

  function finish() {
    setRunning(false);
    setIdx(-1);
    setElapsed(0);
    setPreroll(0);
    setFinished(true);
    beep(660, 120);
    setTimeout(() => beep(990, 300), 160);
  }

  function goTo(i: number) {
    if (i >= moves.length) {
      finish();
      return;
    }
    // Keep the ref in step straight away so the next tick cannot run the
    // old move on for one more beat.
    state.current = { ...state.current, idx: Math.max(0, i), elapsed: 0, preroll: 0 };
    setIdx(Math.max(0, i));
    setElapsed(0);
    setPreroll(0);
    beep(880, 180);
  }

  const handlers = useRef({ beep, goTo });
  useEffect(() => {
    handlers.current = { beep, goTo };
  });

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      const cur = state.current;
      const { beep, goTo } = handlers.current;
      if (cur.preroll > 0) {
        const before = Math.ceil(cur.preroll / 1000);
        const left = cur.preroll - dt;
        const after = Math.ceil(Math.max(left, 0) / 1000);
        if (after < before && after > 0) beep(520, 90);
        if (left <= 0) goTo(0);
        else {
          state.current = { ...cur, preroll: left };
          setPreroll(left);
        }
      } else if (cur.idx >= 0) {
        const move = moves[cur.idx];
        const before = Math.ceil(move.seconds - cur.elapsed / 1000);
        const next = cur.elapsed + dt;
        const after = Math.ceil(move.seconds - next / 1000);
        if (after < before && after > 0 && after <= 3) beep(520, 90);
        if (next >= move.seconds * 1000) goTo(cur.idx + 1);
        else {
          state.current = { ...cur, elapsed: next };
          setElapsed(next);
        }
      }
    }, 100);
    return () => clearInterval(timer);
  }, [running, moves]);

  // Keep the screen awake while running, so the tablet does not dim mid take.
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    navigator.wakeLock
      ?.request("screen")
      .then((w) => {
        if (cancelled) w.release();
        else wakeRef.current = w;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      wakeRef.current?.release().catch(() => {});
      wakeRef.current = null;
    };
  }, [running]);

  function start() {
    if (moves.length === 0) return;
    setFinished(false);
    if (idx < 0 && preroll === 0) setPreroll(PRE_SECONDS * 1000);
    setRunning(true);
    beep(520, 90);
  }

  function restart() {
    setRunning(false);
    setIdx(-1);
    setElapsed(0);
    setPreroll(0);
    setFinished(false);
  }

  function skip() {
    if (idx >= 0) goTo(idx + 1);
    else if (preroll > 0) goTo(0);
  }

  function back() {
    if (idx > 0) goTo(idx - 1);
    else if (idx === 0) setElapsed(0);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        document.getElementById("prompter-go")?.click();
      }
      if (e.key === "ArrowRight") document.getElementById("prompter-skip")?.click();
      if (e.key === "ArrowLeft") document.getElementById("prompter-back")?.click();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const inPre = preroll > 0;
  const cur = idx >= 0 ? moves[idx] : null;
  const shown = inPre ? moves[0] : cur;
  const upcoming = inPre ? null : idx >= 0 ? moves[idx + 1] : moves[0];

  let phase = "Ready";
  let count = formatDuration(total);
  let progress = 0;
  let scale = 1;
  let breath = "";
  if (finished) phase = "Complete";
  if (inPre) {
    phase = "Get into position";
    count = String(Math.ceil(preroll / 1000));
    progress = 1 - preroll / (PRE_SECONDS * 1000);
  } else if (cur) {
    phase = `Move ${idx + 1} of ${moves.length}`;
    count = String(Math.ceil(cur.seconds - elapsed / 1000));
    progress = elapsed / 1000 / cur.seconds;
    if (cur.breathSeconds > 0) {
      const ph = ((elapsed / 1000) % cur.breathSeconds) / cur.breathSeconds;
      scale = 0.62 + 0.38 * (0.5 - 0.5 * Math.cos(2 * Math.PI * ph));
      breath = ph < 0.5 ? "Out" : "Back";
    }
  }

  const spent = cur ? moves.slice(0, idx).reduce((a, m) => a + m.seconds, 0) + elapsed / 1000 : 0;

  return (
    <div className={`${s.prompter} ${mirror ? s.mirror : ""}`}>
      <div className={s.prompterBar}>
        <Link href={`/clinic/vault/flows/${flow.id}`}>Back to the flow</Link>
        <span>{flow.title}</span>
      </div>

      <div className={s.stage}>
        <div className={`${s.phase} ${s.mirrorable}`}>{phase}</div>
        <h2 className={`${s.moveName} ${s.mirrorable}`}>
          {finished ? "Flow finished" : shown ? shown.name : "Press start"}
        </h2>
        {shown?.side && !finished && <div className={`${s.side} ${s.mirrorable}`}>{shown.side}</div>}
        <div className={s.dial}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className={s.track} cx="50" cy="50" r="46" />
            <circle
              className={s.progress}
              cx="50"
              cy="50"
              r="46"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - Math.min(1, progress))}
            />
          </svg>
          <div className={s.pacer} style={{ transform: `scale(${scale.toFixed(3)})` }}>
            <div className={`${s.count} ${s.mirrorable}`}>{count}</div>
          </div>
          <div className={`${s.breathLabel} ${s.mirrorable}`}>{breath}</div>
        </div>
        <p className={`${s.cue} ${s.mirrorable}`}>
          {finished
            ? ""
            : shown
              ? shown.cue
              : `A ${PRE_SECONDS} second countdown gives you time to get into position.`}
        </p>
        <div className={`${s.next} ${s.mirrorable}`}>
          {!finished && upcoming && (
            <>
              {idx < 0 && !inPre ? "First move: " : "Next: "}
              <b>
                {upcoming.name}
                {upcoming.side ? ` (${upcoming.side})` : ""}
              </b>
            </>
          )}
          {!finished && cur && !upcoming && <b>Last move</b>}
        </div>
      </div>

      <div>
        <div className={s.bar}>
          <i style={{ width: `${total ? (100 * spent) / total : 0}%` }} />
        </div>
        <div className={s.barMeta}>
          <span>{cur ? `Move ${idx + 1} of ${moves.length}` : `${moves.length} moves`}</span>
          <span>{cur ? `${formatDuration(total - spent)} left` : `${formatDuration(total)} in total`}</span>
        </div>
        <div className={s.controls}>
          <button id="prompter-go" type="button" className={s.go} onClick={() => (running ? setRunning(false) : start())}>
            {running ? "Pause" : idx >= 0 || inPre ? "Resume" : finished ? "Start again" : "Start"}
          </button>
          <button id="prompter-back" type="button" onClick={back}>
            Back
          </button>
          <button id="prompter-skip" type="button" onClick={skip}>
            Skip
          </button>
          <button type="button" onClick={restart}>
            Restart
          </button>
          <button type="button" aria-pressed={sound} onClick={() => setSound((v) => !v)}>
            {sound ? "Sound on" : "Sound off"}
          </button>
          <button type="button" aria-pressed={mirror} onClick={() => setMirror((v) => !v)}>
            Mirror text
          </button>
        </div>
      </div>
    </div>
  );
}
