"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PERSON_ARMS, type ArmKey, type BackgroundPart } from "@/lib/personMap";
import type { ArmCount } from "@/lib/backgroundSummary";

// The three arms of Client background as circles standing on a triangle
// laid flat in perspective. The one being viewed stands at the front, at
// the narrow point nearest the viewer, large and in orange; the other two
// stand further back, wide apart. Choosing another arm turns the three
// round, like a carousel, until that one is at the front.
//
// The thin lines that bend at 45 degrees and end in a dot echo the
// connector lines of the Regenerate mark. Always drawn in Regenerate
// colours, taken from the Regenerate logo for now, until the Regenerate
// brand pack exists.
const REGEN = {
  orange: "#F7941D",
  amber: "#E2761B",
  deep: "#A8420C",
  coral: "#C8553D",
  ink: "#0B0B0B",
  charcoal: "#1D1D1D",
};

type Props = {
  base: string;
  active: BackgroundPart;
  arms: ArmCount[];
};

// The circles move round an ellipse seen from slightly above.
const CX = 500;
const CY = 150;
const RX = 330;
const RY = 96;
const FRONT_R = 92;
const BACK_SCALE = 0.62;
const STEP = (2 * Math.PI) / 3;
const DURATION = 750;

const KEYS = PERSON_ARMS.map((a) => a.key);

// The turn of the whole carousel that brings a given arm to the front.
function turnFor(key: ArmKey | null): number {
  const i = key ? KEYS.indexOf(key) : 0;
  return -i * STEP;
}

type Placed = { key: ArmKey; x: number; y: number; r: number; depth: number };

function place(turn: number): Placed[] {
  return KEYS.map((key, i) => {
    const angle = Math.PI / 2 + i * STEP + turn; // pi/2 is the front
    const depth = (Math.sin(angle) + 1) / 2; // 1 at the front, 0 at the back
    const scale = BACK_SCALE + (1 - BACK_SCALE) * Math.max(0, (depth - 0.25) / 0.75);
    return { key, x: CX + RX * Math.cos(angle), y: CY + RY * Math.sin(angle), r: FRONT_R * scale, depth };
  });
}

function between(a: Placed, b: Placed) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x1: a.x + (dx / len) * a.r, y1: a.y + (dy / len) * a.r, x2: b.x - (dx / len) * b.r, y2: b.y - (dy / len) * b.r };
}

// Connector traces around a circle, in units of its radius. Symmetric, so
// they sit well wherever the circle has turned to.
const TRACE_SHAPES = [
  [-1, 0, -1.6, 0, -2.0, -0.4],
  [1, 0, 1.6, 0, 2.0, -0.4],
  [-0.71, -0.71, -1.05, -1.05, -1.55, -1.05],
  [0.71, -0.71, 1.05, -1.05, 1.55, -1.05],
  [-0.71, 0.71, -1.0, 1.0, -1.45, 1.0],
  [0.71, 0.71, 1.0, 1.0, 1.45, 1.0],
];

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function PersonMap({ base, active, arms }: Props) {
  const router = useRouter();
  const activeArm = KEYS.includes(active as ArmKey) ? (active as ArmKey) : null;
  // Highlight straight away on a click, before the page has caught up. Once
  // the page moves on, the page decides again.
  const [pending, setPending] = useState<{ part: BackgroundPart; from: BackgroundPart } | null>(null);
  const chosen = pending && pending.from === active ? pending.part : active;
  const [turn, setTurn] = useState(() => turnFor(activeArm));
  const turnRef = useRef(turn);
  const frame = useRef<number | null>(null);

  function spinTo(key: ArmKey) {
    const target = turnFor(key);
    const from = turnRef.current;
    // Go the shorter way round.
    let delta = (target - from) % (2 * Math.PI);
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    if (Math.abs(delta) < 0.001) return;
    if (frame.current) cancelAnimationFrame(frame.current);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 1 : DURATION;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      turnRef.current = from + delta * easeInOut(t);
      setTurn(turnRef.current);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }

  // Follow the page, for example after the back button.
  useEffect(() => {
    if (activeArm) spinTo(activeArm);
  }, [activeArm]);

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  function go(e: React.MouseEvent, part: BackgroundPart) {
    e.preventDefault();
    setPending({ part, from: active });
    if (part !== "person") spinTo(part);
    router.push(part === "person" ? base : `${base}?part=${part}`, { scroll: false });
  }

  const placed = place(turn);
  const drawOrder = [...placed].sort((a, b) => a.depth - b.depth);
  const personOn = chosen === "person";

  return (
    <div>
      <svg
        viewBox="0 0 1000 362"
        role="group"
        aria-label="Client background: physiology, psychology and physicality"
        style={{ width: "100%", maxWidth: 820, display: "block", margin: "0 auto" }}
      >
        <defs>
          <linearGradient id="pm-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={REGEN.orange} stopOpacity="0.04" />
            <stop offset="1" stopColor={REGEN.deep} stopOpacity="0.34" />
          </linearGradient>
          <radialGradient id="pm-off" cx="0.38" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#3a3a3a" />
            <stop offset="0.55" stopColor={REGEN.charcoal} />
            <stop offset="1" stopColor={REGEN.ink} />
          </radialGradient>
          <radialGradient id="pm-on" cx="0.38" cy="0.28" r="0.85">
            <stop offset="0" stopColor="#FFB35C" />
            <stop offset="0.45" stopColor={REGEN.orange} />
            <stop offset="1" stopColor={REGEN.deep} />
          </radialGradient>
          <radialGradient id="pm-gloss" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="pm-shadow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#000" stopOpacity="0.6" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* The ground: the triangle between the three circles, filled */}
        <polygon points={placed.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="url(#pm-ground)" />
        {placed.map((p, i) => {
          const q = placed[(i + 1) % placed.length];
          return <line key={`${p.key}-${q.key}`} {...between(p, q)} stroke={REGEN.amber} strokeOpacity={0.75} strokeWidth={2} />;
        })}

        {drawOrder.map((p) => {
          const arm = PERSON_ARMS.find((a) => a.key === p.key)!;
          const on = chosen === p.key;
          const s = p.r / FRONT_R;
          const count = arms.find((a) => a.key === p.key);
          const href = `${base}?part=${p.key}`;
          return (
            <a key={p.key} href={href} onClick={(e) => go(e, p.key)} aria-label={`${arm.label}, ${arm.source}`} aria-current={on ? "page" : undefined}>
              <title>{`${arm.source}: ${arm.detail}`}</title>
              {TRACE_SHAPES.map((t, i) => {
                const pt = (j: number) => `${(p.x + t[j] * p.r).toFixed(1)} ${(p.y + t[j + 1] * p.r).toFixed(1)}`;
                return (
                  <g key={i} opacity={0.7}>
                    <path d={`M ${pt(0)} L ${pt(2)} L ${pt(4)}`} fill="none" stroke={REGEN.coral} strokeWidth={1.8 * s} strokeLinejoin="round" />
                    <circle cx={p.x + t[4] * p.r} cy={p.y + t[5] * p.r} r={4.5 * s} fill={REGEN.coral} />
                  </g>
                );
              })}
              <ellipse cx={p.x} cy={p.y + p.r * 0.98} rx={p.r * 0.82} ry={p.r * 0.15} fill="url(#pm-shadow)" />
              <circle cx={p.x} cy={p.y} r={p.r} fill={on ? "url(#pm-on)" : "url(#pm-off)"} stroke={on ? REGEN.orange : REGEN.amber} strokeWidth={on ? 3 : 2} style={{ cursor: "pointer" }} />
              <ellipse cx={p.x - p.r * 0.18} cy={p.y - p.r * 0.5} rx={p.r * 0.58} ry={p.r * 0.3} fill="url(#pm-gloss)" pointerEvents="none" />
              <text x={p.x} y={p.y - 2 * s} textAnchor="middle" fill="#fff" style={{ fontSize: 25 * s, fontFamily: "var(--font-fraunces), serif", fontWeight: 600, pointerEvents: "none" }}>
                {arm.label}
              </text>
              <text x={p.x} y={p.y + 22 * s} textAnchor="middle" fill="#fff" style={{ fontSize: 14 * s, opacity: 0.9, pointerEvents: "none" }}>
                {arm.source}
              </text>
              <text x={p.x} y={p.y + 42 * s} textAnchor="middle" fill="#fff" style={{ fontSize: 12.5 * s, opacity: 0.65, pointerEvents: "none" }}>
                {count && count.count > 0 ? `${count.count} on record` : "nothing yet"}
              </text>
            </a>
          );
        })}
      </svg>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 2 }}>
        <a
          href={base}
          onClick={(e) => go(e, "person")}
          aria-current={personOn ? "page" : undefined}
          style={{
            padding: "8px 18px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            border: `1.5px solid ${REGEN.amber}`,
            background: personOn ? `linear-gradient(180deg, ${REGEN.orange}, ${REGEN.deep})` : "rgba(0,0,0,0.35)",
            color: "#fff",
          }}
        >
          Client context summary
        </a>
      </div>
    </div>
  );
}
