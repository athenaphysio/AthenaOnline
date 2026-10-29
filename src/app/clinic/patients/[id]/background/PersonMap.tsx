import { PERSON_ARMS, type BackgroundPart } from "@/lib/personMap";
import type { ArmCount } from "@/lib/backgroundSummary";

// The person at the centre of Client background, with the three arms as
// circles joined in a triangle around them. The thin lines that bend at
// 45 degrees and end in a dot echo the connector lines of the Regenerate
// mark. Every circle is a link, so the diagram is also the way around this
// tab. Colours come from the page, so it takes on the client's brand pack.

type Props = {
  base: string;
  active: BackgroundPart;
  name: string;
  consultations: number;
  arms: ArmCount[];
  photoUrl?: string | null;
};

// An equilateral triangle: each side SIDE long, the person at its centre.
const SIDE = 520;
const TOP = { x: 450, y: 100 };
const TRI_H = (SIDE * Math.sqrt(3)) / 2;
const CENTRE = { x: TOP.x, y: TOP.y + (TRI_H * 2) / 3, r: 96 };
const NODE_R = 78;
const NODES: Record<string, { x: number; y: number }> = {
  physiology: TOP,
  psychology: { x: TOP.x - SIDE / 2, y: TOP.y + TRI_H },
  physicality: { x: TOP.x + SIDE / 2, y: TOP.y + TRI_H },
};
const ORDER = ["physiology", "psychology", "physicality"] as const;

// A straight line between two circles, stopping at their edges.
function between(a: { x: number; y: number }, ra: number, b: { x: number; y: number }, rb: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: a.x + ux * ra,
    y1: a.y + uy * ra,
    x2: b.x - ux * rb,
    y2: b.y - uy * rb,
  };
}

// Short connector traces leaving the circles, each ending in a dot. Each
// is written as offsets from its circle's centre.
const D = NODE_R * Math.SQRT1_2; // a point on the circle at 45 degrees
const TRACE_SHAPES: Record<string, number[][]> = {
  physiology: [
    [-NODE_R, 0, -NODE_R - 54, 0, -NODE_R - 84, -30],
    [NODE_R, 0, NODE_R + 54, 0, NODE_R + 84, -30],
    [-D, -D, -D - 23, -D - 23, -D - 65, -D - 23],
    [D, -D, D + 23, -D - 23, D + 65, -D - 23],
  ],
  psychology: [
    [-NODE_R, 0, -NODE_R - 42, 0, -NODE_R - 70, -28],
    [0, NODE_R, 0, NODE_R + 20, -32, NODE_R + 20],
    [-D, D, -D - 27, D + 27, -D - 57, D + 27],
  ],
  physicality: [
    [NODE_R, 0, NODE_R + 42, 0, NODE_R + 70, -28],
    [0, NODE_R, 0, NODE_R + 20, 32, NODE_R + 20],
    [D, D, D + 27, D + 27, D + 57, D + 27],
  ],
};
const TRACES = Object.entries(TRACE_SHAPES).flatMap(([k, shapes]) =>
  shapes.map((pts) => {
    const n = NODES[k];
    const xy = (i: number) => `${(n.x + pts[i]).toFixed(1)} ${(n.y + pts[i + 1]).toFixed(1)}`;
    return `M ${xy(0)} L ${xy(2)} L ${xy(4)}`;
  }),
);

function traceEnd(path: string): [number, number] {
  const nums = path.match(/-?\d+(\.\d+)?/g)!.map(Number);
  return [nums[nums.length - 2], nums[nums.length - 1]];
}

export default function PersonMap({ base, active, name, consultations, arms, photoUrl }: Props) {
  const line = "rgba(var(--wash), 0.3)";
  const shortName = name.length > 22 ? name.split(" ")[0] : name;
  const nameSize = Math.min(25, 290 / Math.max(shortName.length, 1));
  const personOn = active === "person";

  return (
    <svg
      viewBox="0 0 900 690"
      role="group"
      aria-label="Client background: the person at the centre, with physiology, psychology and physicality around them"
      style={{ width: "100%", maxWidth: 720, display: "block", margin: "0 auto", color: "inherit" }}
    >
      {/* Connector traces, in the brand accent */}
      {TRACES.map((d) => {
        const [x, y] = traceEnd(d);
        return (
          <g key={d} style={{ opacity: 0.55 }}>
            <path d={d} fill="none" style={{ stroke: "var(--crimson)" }} strokeWidth={2} strokeLinejoin="round" />
            <circle cx={x} cy={y} r={5.5} style={{ fill: "var(--crimson)" }} />
          </g>
        );
      })}

      {/* The triangle joining the three arms */}
      {ORDER.map((k, i) => {
        const next = ORDER[(i + 1) % ORDER.length];
        const l = between(NODES[k], NODE_R, NODES[next], NODE_R);
        return <line key={`${k}-${next}`} {...l} stroke={line} strokeWidth={2.5} />;
      })}

      {/* Each arm back to the person, ending in a dot at the centre circle */}
      {ORDER.map((k) => {
        const l = between(CENTRE, CENTRE.r + 12, NODES[k], NODE_R);
        const on = active === k;
        return (
          <g key={`spoke-${k}`}>
            <line {...l} style={{ stroke: on ? "var(--crimson)" : line }} strokeWidth={on ? 3.5 : 2} />
            <circle cx={l.x1} cy={l.y1} r={6} style={{ fill: on ? "var(--crimson)" : line }} />
          </g>
        );
      })}

      {/* The person */}
      <a href={base} aria-label={`${name}, client context`} aria-current={personOn ? "page" : undefined}>
        <title>Client context summary and full background notes</title>
        <circle
          cx={CENTRE.x}
          cy={CENTRE.y}
          r={CENTRE.r}
          style={{ fill: personOn ? "var(--crimson)" : "var(--charcoal-2)", stroke: "var(--crimson)", cursor: "pointer" }}
          strokeWidth={3.5}
        />
        {photoUrl ? (
          <>
            <defs>
              <clipPath id="person-photo-clip">
                <circle cx={CENTRE.x} cy={CENTRE.y} r={CENTRE.r - 6} />
              </clipPath>
              <linearGradient id="person-photo-fade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0.45" stopColor="#000" stopOpacity="0" />
                <stop offset="1" stopColor="#000" stopOpacity="0.78" />
              </linearGradient>
            </defs>
            <g clipPath="url(#person-photo-clip)" style={{ cursor: "pointer" }}>
              <image
                href={photoUrl}
                x={CENTRE.x - CENTRE.r}
                y={CENTRE.y - CENTRE.r}
                width={CENTRE.r * 2}
                height={CENTRE.r * 2}
                preserveAspectRatio="xMidYMid slice"
              />
              <rect x={CENTRE.x - CENTRE.r} y={CENTRE.y - CENTRE.r} width={CENTRE.r * 2} height={CENTRE.r * 2} fill="url(#person-photo-fade)" />
            </g>
            <text x={CENTRE.x} y={CENTRE.y + 44} textAnchor="middle" fill="#fff" style={{ fontSize: Math.min(nameSize, 18), fontFamily: "var(--font-fraunces), serif", fontWeight: 600 }}>
              {shortName}
            </text>
            <text x={CENTRE.x} y={CENTRE.y + 64} textAnchor="middle" fill="#fff" style={{ fontSize: 12, opacity: 0.9 }}>
              Client context
            </text>
          </>
        ) : (
          <>
            <circle cx={CENTRE.x} cy={CENTRE.y} r={CENTRE.r - 9} fill="none" style={{ stroke: personOn ? "rgba(255,255,255,0.45)" : "var(--crimson)", opacity: 0.45 }} strokeWidth={1.5} />
            <text x={CENTRE.x} y={CENTRE.y - 34} textAnchor="middle" fill={personOn ? "#fff" : "currentColor"} style={{ fontSize: 13, letterSpacing: 2.5, opacity: 0.8, fontWeight: 600 }}>
              THE PERSON
            </text>
            <text x={CENTRE.x} y={CENTRE.y + 6} textAnchor="middle" fill={personOn ? "#fff" : "currentColor"} style={{ fontSize: nameSize, fontFamily: "var(--font-fraunces), serif", fontWeight: 600 }}>
              {shortName}
            </text>
            <text x={CENTRE.x} y={CENTRE.y + 34} textAnchor="middle" fill={personOn ? "#fff" : "currentColor"} style={{ fontSize: 14, opacity: 0.85 }}>
              Client context
            </text>
            <text x={CENTRE.x} y={CENTRE.y + 54} textAnchor="middle" fill={personOn ? "#fff" : "currentColor"} style={{ fontSize: 12.5, opacity: 0.65 }}>
              {consultations === 0 ? "nothing yet" : `${consultations} consultation${consultations === 1 ? "" : "s"}`}
            </text>
          </>
        )}
      </a>

      {/* The three arms */}
      {PERSON_ARMS.map((arm) => {
        const n = NODES[arm.key];
        const on = active === arm.key;
        const count = arms.find((a) => a.key === arm.key);
        const ink = on ? "#fff" : "currentColor";
        return (
          <a key={arm.key} href={`${base}?part=${arm.key}`} aria-label={`${arm.label}, ${arm.source}`} aria-current={on ? "page" : undefined}>
            <title>{`${arm.source}: ${arm.detail}`}</title>
            <circle
              cx={n.x}
              cy={n.y}
              r={NODE_R}
              style={{ fill: on ? "var(--crimson)" : "var(--charcoal-2)", stroke: "var(--crimson)", cursor: "pointer" }}
              strokeWidth={on ? 3.5 : 2.5}
            />
            <text x={n.x} y={n.y - 4} textAnchor="middle" fill={ink} style={{ fontSize: 20, fontFamily: "var(--font-fraunces), serif", fontWeight: 600 }}>
              {arm.label}
            </text>
            <text x={n.x} y={n.y + 18} textAnchor="middle" fill={ink} style={{ fontSize: 12.5, opacity: 0.85 }}>
              {arm.source}
            </text>
            <text x={n.x} y={n.y + 37} textAnchor="middle" fill={ink} style={{ fontSize: 11.5, opacity: 0.65 }}>
              {count && count.count > 0 ? `${count.count} on record` : "nothing yet"}
            </text>
          </a>
        );
      })}
    </svg>
  );
}
