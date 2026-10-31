"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Three flat hexagons, drawn as on the Performance Blueprint page of the
// Corporate Athlete material: a fine outer line, a white line and the
// accent line inside it. Two sit side by side at the top and the third
// nestles between them below. The bottom one is the open one. Choosing
// either of the top two slides it down into the open place, and the one
// that was open slides up into the place it left.
//
// Used by Client profile in the clinic and by My Passport in the client's
// app, so both show the same picture. Colours come from CSS variables set
// by the brand pack's palette, with the standard accent as the fallback.

export type HexItem = {
  key: string;
  label: string;
  /** A line under the label, for example "Health passport". */
  line?: string;
  /** A smaller line under that, for example "6 on record". */
  meta?: string;
  href: string;
  /** Spoken and hover description. */
  description?: string;
};

type Props = {
  items: HexItem[];
  /** The open hexagon, or null when none is open (the bottom one then shows as closed). */
  open: string | null;
  /** Which item sits at the bottom when none is open. Defaults to the first. */
  restingKey?: string;
  maxWidth?: number;
  ariaLabel: string;
};

const R = 100; // outer radius of each hexagon
const S = 106; // spacing radius, a little more than R so the outer lines just clear
const W = 660;
const CX = W / 2;
const TOP = 112;
const H = 330;
const SLOTS = [
  { x: CX - 1.5 * S, y: TOP }, // top left
  { x: CX + 1.5 * S, y: TOP }, // top right
  { x: CX, y: TOP + Math.sqrt(3) * S * 0.5 }, // bottom, the open place
];

function hexPoints(r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;
    pts.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

const OUTER = hexPoints(R);
const MIDDLE = hexPoints(R - 8);
const INNER = hexPoints(R - 14);

const ACCENT = "var(--hex-accent, var(--crimson))";
const LINE = "var(--hex-line, #ffffff)";
const OUTER_LINE = "var(--hex-outer, rgba(255,255,255,0.35))";
const FILL = "var(--hex-fill, rgba(0,0,0,0.35))";
const TRACE = "var(--hex-trace, var(--crimson))";
const TRACE_ALT = "var(--hex-trace-alt, rgba(255,255,255,0.5))";

// Fine circuit lines around the cluster, fixed in place, as in the pack.
const TRACES: { d: string; dot: [number, number]; alt?: boolean }[] = [
  { d: `M ${CX - 2.5 * S - 22} ${TOP - 70} H ${CX - 2.5 * S + 34} L ${CX - 2.5 * S + 56} ${TOP - 48}`, dot: [CX - 2.5 * S - 22, TOP - 70] },
  { d: `M ${CX - 0.5 * S} ${TOP - 96} V ${TOP - 40}`, dot: [CX - 0.5 * S, TOP - 96], alt: true },
  { d: `M ${CX + 0.5 * S + 18} ${TOP - 92} H ${CX + 0.5 * S + 70} L ${CX + 0.5 * S + 92} ${TOP - 70}`, dot: [CX + 0.5 * S + 18, TOP - 92] },
  { d: `M ${CX + 2.5 * S + 26} ${TOP + 40} V ${TOP + 110} L ${CX + 2.5 * S + 6} ${TOP + 130}`, dot: [CX + 2.5 * S + 26, TOP + 40], alt: true },
  { d: `M ${CX - 2.5 * S - 30} ${TOP + 150} H ${CX - 1.5 * S - 40}`, dot: [CX - 2.5 * S - 30, TOP + 150] },
  { d: `M ${CX + 1.5 * S + 30} ${TOP + 178} H ${CX + 2.5 * S + 30}`, dot: [CX + 2.5 * S + 30, TOP + 178] },
];

function moveToBottom(o: string[], key: string): string[] {
  const at = o.indexOf(key);
  if (at === -1 || at === 2) return o;
  const next = [...o];
  next[at] = o[2];
  next[2] = key;
  return next;
}

function arrange(keys: string[], bottom: string): string[] {
  if (!keys.includes(bottom)) return keys;
  const rest = keys.filter((k) => k !== bottom);
  return [rest[0], rest[1], bottom];
}

export default function HexMap({ items, open, restingKey, maxWidth = 640, ariaLabel }: Props) {
  const router = useRouter();
  const keys = items.map((i) => i.key);
  const startBottom = open ?? restingKey ?? keys[0];
  // order[slot] = the key in that slot. Kept between choices, so the one
  // that leaves the bottom takes the exact place the chosen one came from.
  const [order, setOrder] = useState<string[]>(() => arrange(keys, startBottom));
  const [chosen, setChosen] = useState<string | null>(open);

  // Follow the page, for example after the back button.
  const [seenOpen, setSeenOpen] = useState(open);
  if (open !== seenOpen) {
    setSeenOpen(open);
    setChosen(open);
    if (open) setOrder((o) => moveToBottom(o, open));
  }

  function pick(e: React.MouseEvent, item: HexItem) {
    e.preventDefault();
    setOrder((o) => moveToBottom(o, item.key));
    setChosen(item.key);
    router.push(item.href, { scroll: false });
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={ariaLabel} style={{ width: "100%", maxWidth, display: "block", margin: "0 auto", overflow: "visible" }}>
      <defs>
        <radialGradient id="hex-open-glow" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" style={{ stopColor: ACCENT, stopOpacity: 0.26 }} />
          <stop offset="1" style={{ stopColor: ACCENT, stopOpacity: 0.02 }} />
        </radialGradient>
        <filter id="hex-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {TRACES.map((t, i) => (
        <g key={i} opacity={0.75}>
          <path d={t.d} fill="none" strokeWidth={1.2} style={{ stroke: t.alt ? TRACE_ALT : TRACE }} />
          <circle cx={t.dot[0]} cy={t.dot[1]} r={3.2} style={{ fill: t.alt ? TRACE_ALT : TRACE }} />
        </g>
      ))}

      {items.map((item) => {
        const slot = SLOTS[Math.max(0, order.indexOf(item.key))];
        const isOpen = chosen === item.key && order.indexOf(item.key) === 2;
        return (
          <a
            key={item.key}
            href={item.href}
            onClick={(e) => pick(e, item)}
            aria-label={`${item.label}${item.line ? `, ${item.line}` : ""}`}
            aria-current={isOpen ? "page" : undefined}
          >
            {item.description && <title>{item.description}</title>}
            <g
              style={{
                transform: `translate(${slot.x}px, ${slot.y}px)`,
                transition: "transform 650ms cubic-bezier(0.65, 0, 0.35, 1)",
                cursor: "pointer",
              }}
            >
              <polygon points={OUTER} fill="none" strokeWidth={1.4} style={{ stroke: OUTER_LINE }} />
              <polygon points={MIDDLE} strokeWidth={2.4} style={{ fill: FILL, stroke: LINE }} />
              {isOpen && <polygon points={MIDDLE} fill="url(#hex-open-glow)" />}
              <polygon
                points={INNER}
                fill="none"
                strokeWidth={isOpen ? 3 : 1.8}
                filter={isOpen ? "url(#hex-soft-glow)" : undefined}
                style={{ stroke: ACCENT, opacity: isOpen ? 1 : 0.7, transition: "opacity 400ms" }}
              />
              <FitLabel y={item.line ? -10 : 6} text={item.label.toUpperCase()} />
              {item.line && (
                <text x={0} y={16} textAnchor="middle" style={{ fill: LINE, fontSize: 14.5, pointerEvents: "none" }}>
                  {item.line}
                </text>
              )}
              {item.meta && (
                <text x={0} y={37} textAnchor="middle" style={{ fill: LINE, opacity: 0.68, fontSize: 12.5, pointerEvents: "none" }}>
                  {item.meta}
                </text>
              )}
            </g>
          </a>
        );
      })}
    </svg>
  );
}

// The hexagon's title, in the brand's heading typeface. A wide face (a
// serif such as Ergon's) is brought down in size until the word fits
// inside the hexagon; a narrow one (Regenerate's condensed) stays as set.
const LABEL_SIZE = 21;
const LABEL_MAX_WIDTH = 146;

function FitLabel({ y, text }: { y: number; text: string }) {
  const ref = useRef<SVGTextElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = `${LABEL_SIZE}px`;
      const w = el.getComputedTextLength();
      if (w > LABEL_MAX_WIDTH) el.style.fontSize = `${Math.max(12, (LABEL_SIZE * LABEL_MAX_WIDTH) / w)}px`;
    };
    fit();
    // Measure again once the brand's typeface has arrived.
    document.fonts?.ready.then(fit).catch(() => {});
  }, [text]);
  return (
    <text
      ref={ref}
      x={0}
      y={y}
      textAnchor="middle"
      style={{
        fill: ACCENT,
        fontFamily: "var(--font-fraunces), serif",
        fontSize: LABEL_SIZE,
        fontWeight: 600,
        letterSpacing: "0.05em",
        pointerEvents: "none",
      }}
    >
      {text}
    </text>
  );
}
