import { PERSON_ARMS, type BackgroundPart } from "@/lib/personMap";
import type { ArmCount } from "@/lib/backgroundSummary";

// The person at the centre of Client background, with the three arms as
// circles joined in a triangle laid flat in perspective: a wide base at the
// front, narrowing to a distant point at the back. The circles stand up on
// that ground, so the one at the back is smaller, and each has a soft
// shadow beneath it. The thin lines that bend at 45 degrees and end in a dot
// echo the connector lines of the Regenerate mark. Every circle is a link,
// and the one being viewed turns orange.
//
// Always drawn in Regenerate colours. These are taken from the Regenerate
// logo for now, and will move to the Regenerate brand pack once it exists.
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
  name: string;
  consultations: number;
  arms: ArmCount[];
  photoUrl?: string | null;
};

type Node = { x: number; y: number; r: number };

// The back point sits high and small; the two front circles sit low and
// wide apart, and larger because they are nearer.
const NODES: Record<string, Node> = {
  physiology: { x: 500, y: 66, r: 50 },
  psychology: { x: 150, y: 278, r: 66 },
  physicality: { x: 850, y: 278, r: 66 },
};
const ORDER = ["physiology", "psychology", "physicality"] as const;
const tri = ORDER.map((k) => NODES[k]);
// The person stands at the centre of the triangle.
const CENTRE: Node = {
  x: 500,
  y: Math.round(tri.reduce((s, n) => s + n.y, 0) / 3) + 6,
  r: 68,
};

// A straight line between two circles, stopping at their edges.
function between(a: Node, b: Node, padA = 0) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  return { x1: a.x + ux * (a.r + padA), y1: a.y + uy * (a.r + padA), x2: b.x - ux * b.r, y2: b.y - uy * b.r };
}

// Short connector traces leaving the circles, each ending in a dot. Written
// as offsets from the circle, in units of its radius, so they scale with it.
const TRACE_SHAPES: Record<string, number[][]> = {
  physiology: [
    [-1, 0, -1.7, 0, -2.2, -0.5],
    [1, 0, 1.7, 0, 2.2, -0.5],
    [-0.71, -0.71, -1.1, -1.1, -1.9, -1.1],
    [0.71, -0.71, 1.1, -1.1, 1.9, -1.1],
  ],
  psychology: [
    [-1, 0, -1.55, 0, -1.95, -0.4],
    [-0.71, 0.71, -1.05, 1.05, -1.6, 1.05],
    [-0.71, -0.71, -1.05, -1.05, -1.6, -1.05],
  ],
  physicality: [
    [1, 0, 1.55, 0, 1.95, -0.4],
    [0.71, 0.71, 1.05, 1.05, 1.6, 1.05],
    [0.71, -0.71, 1.05, -1.05, 1.6, -1.05],
  ],
};
const TRACES = Object.entries(TRACE_SHAPES).flatMap(([k, shapes]) =>
  shapes.map((pts) => {
    const n = NODES[k];
    const p = (i: number) => [n.x + pts[i] * n.r, n.y + pts[i + 1] * n.r];
    const [a, b, c] = [p(0), p(2), p(4)];
    return { d: `M ${a[0].toFixed(1)} ${a[1].toFixed(1)} L ${b[0].toFixed(1)} ${b[1].toFixed(1)} L ${c[0].toFixed(1)} ${c[1].toFixed(1)}`, end: c, scale: n.r / 66 };
  }),
);

// The soft shadow on the ground beneath a standing circle.
function Shadow({ n }: { n: Node }) {
  return <ellipse cx={n.x} cy={n.y + n.r * 0.98} rx={n.r * 0.82} ry={n.r * 0.16} fill="url(#pm-shadow)" />;
}

// A shaded, standing circle: dark with an orange rim, or orange when it is
// the one being viewed.
function Disc({ n, on }: { n: Node; on: boolean }) {
  return (
    <>
      <circle cx={n.x} cy={n.y} r={n.r} fill={on ? "url(#pm-on)" : "url(#pm-off)"} stroke={on ? REGEN.orange : REGEN.amber} strokeWidth={on ? 3 : 2} style={{ cursor: "pointer" }} />
      <ellipse cx={n.x - n.r * 0.18} cy={n.y - n.r * 0.5} rx={n.r * 0.58} ry={n.r * 0.3} fill="url(#pm-gloss)" pointerEvents="none" />
    </>
  );
}

export default function PersonMap({ base, active, name, consultations, arms, photoUrl }: Props) {
  const shortName = name.length > 22 ? name.split(" ")[0] : name;
  const nameSize = Math.min(19, 200 / Math.max(shortName.length, 1));
  const personOn = active === "person";

  function Arm({ k }: { k: string }) {
    const arm = PERSON_ARMS.find((a) => a.key === k)!;
    const n = NODES[k];
    const on = active === k;
    const count = arms.find((a) => a.key === k);
    const s = n.r / 66; // text shrinks with distance
    return (
      <a href={`${base}?part=${arm.key}`} aria-label={`${arm.label}, ${arm.source}`} aria-current={on ? "page" : undefined}>
        <title>{`${arm.source}: ${arm.detail}`}</title>
        <Shadow n={n} />
        <Disc n={n} on={on} />
        <text x={n.x} y={n.y - 2 * s} textAnchor="middle" fill="#fff" style={{ fontSize: 18 * s, fontFamily: "var(--font-fraunces), serif", fontWeight: 600 }}>
          {arm.label}
        </text>
        <text x={n.x} y={n.y + 17 * s} textAnchor="middle" fill="#fff" style={{ fontSize: 11.5 * s, opacity: 0.88 }}>
          {arm.source}
        </text>
        <text x={n.x} y={n.y + 33 * s} textAnchor="middle" fill="#fff" style={{ fontSize: 10.5 * s, opacity: 0.65 }}>
          {count && count.count > 0 ? `${count.count} on record` : "nothing yet"}
        </text>
      </a>
    );
  }

  return (
    <svg
      viewBox="0 0 1000 372"
      role="group"
      aria-label="Client background: the person at the centre, with physiology, psychology and physicality around them"
      style={{ width: "100%", maxWidth: 860, display: "block", margin: "0 auto" }}
    >
      <defs>
        <linearGradient id="pm-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={REGEN.orange} stopOpacity="0.05" />
          <stop offset="1" stopColor={REGEN.deep} stopOpacity="0.32" />
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
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pm-photo-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.4" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.8" />
        </linearGradient>
        <clipPath id="pm-photo-clip">
          <circle cx={CENTRE.x} cy={CENTRE.y} r={CENTRE.r - 4} />
        </clipPath>
      </defs>

      {/* The ground: the triangle filled in, laid flat */}
      <polygon points={tri.map((n) => `${n.x},${n.y}`).join(" ")} fill="url(#pm-ground)" />
      {ORDER.map((k, i) => {
        const next = ORDER[(i + 1) % ORDER.length];
        return <line key={`${k}-${next}`} {...between(NODES[k], NODES[next])} stroke={REGEN.amber} strokeOpacity={0.75} strokeWidth={2} />;
      })}

      {/* Connector traces */}
      {TRACES.map((t) => (
        <g key={t.d} opacity={0.75}>
          <path d={t.d} fill="none" stroke={REGEN.coral} strokeWidth={1.8 * t.scale} strokeLinejoin="round" />
          <circle cx={t.end[0]} cy={t.end[1]} r={5 * t.scale} fill={REGEN.coral} />
        </g>
      ))}

      {/* Each arm back to the person */}
      {ORDER.map((k) => {
        const l = between(CENTRE, NODES[k], 10);
        const on = active === k;
        return (
          <g key={`spoke-${k}`}>
            <line {...l} stroke={on ? REGEN.orange : REGEN.amber} strokeOpacity={on ? 1 : 0.55} strokeWidth={on ? 3.5 : 1.8} />
            <circle cx={l.x1} cy={l.y1} r={5} fill={on ? REGEN.orange : REGEN.amber} fillOpacity={on ? 1 : 0.7} />
          </g>
        );
      })}

      {/* The back circle first, then the person, then the two front circles */}
      <Arm k="physiology" />

      <a href={base} aria-label={`${name}, client context`} aria-current={personOn ? "page" : undefined}>
        <title>Client context summary and full background notes</title>
        <Shadow n={CENTRE} />
        <Disc n={CENTRE} on={personOn} />
        {photoUrl ? (
          <>
            <g clipPath="url(#pm-photo-clip)" style={{ cursor: "pointer" }}>
              <image
                href={photoUrl}
                x={CENTRE.x - CENTRE.r}
                y={CENTRE.y - CENTRE.r}
                width={CENTRE.r * 2}
                height={CENTRE.r * 2}
                preserveAspectRatio="xMidYMid slice"
              />
              <rect x={CENTRE.x - CENTRE.r} y={CENTRE.y - CENTRE.r} width={CENTRE.r * 2} height={CENTRE.r * 2} fill="url(#pm-photo-fade)" />
            </g>
            <text x={CENTRE.x} y={CENTRE.y + 32} textAnchor="middle" fill="#fff" style={{ fontSize: Math.min(nameSize, 16), fontFamily: "var(--font-fraunces), serif", fontWeight: 600 }}>
              {shortName}
            </text>
            <text x={CENTRE.x} y={CENTRE.y + 48} textAnchor="middle" fill="#fff" style={{ fontSize: 10.5, opacity: 0.9 }}>
              Client context
            </text>
          </>
        ) : (
          <>
            <text x={CENTRE.x} y={CENTRE.y - 24} textAnchor="middle" fill="#fff" style={{ fontSize: 10, letterSpacing: 2.2, opacity: 0.8, fontWeight: 600 }}>
              THE PERSON
            </text>
            <text x={CENTRE.x} y={CENTRE.y + 4} textAnchor="middle" fill="#fff" style={{ fontSize: nameSize, fontFamily: "var(--font-fraunces), serif", fontWeight: 600 }}>
              {shortName}
            </text>
            <text x={CENTRE.x} y={CENTRE.y + 24} textAnchor="middle" fill="#fff" style={{ fontSize: 11.5, opacity: 0.88 }}>
              Client context
            </text>
            <text x={CENTRE.x} y={CENTRE.y + 40} textAnchor="middle" fill="#fff" style={{ fontSize: 10.5, opacity: 0.65 }}>
              {consultations === 0 ? "nothing yet" : `${consultations} consultation${consultations === 1 ? "" : "s"}`}
            </text>
          </>
        )}
      </a>

      <Arm k="psychology" />
      <Arm k="physicality" />
    </svg>
  );
}
