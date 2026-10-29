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
};

const CENTRE = { x: 450, y: 338, r: 96 };
const NODE_R = 78;
const NODES: Record<string, { x: number; y: number }> = {
  physiology: { x: 450, y: 104 },
  psychology: { x: 182, y: 486 },
  physicality: { x: 718, y: 486 },
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

// Short connector traces leaving the circles, each ending in a dot.
const TRACES = [
  // Physiology, top
  "M 372 104 L 318 104 L 288 74",
  "M 528 104 L 582 104 L 612 74",
  "M 395 49 L 372 26 L 330 26",
  "M 505 49 L 528 26 L 570 26",
  // Psychology, bottom left
  "M 104 486 L 62 486 L 34 458",
  "M 182 564 L 182 584 L 150 584",
  "M 127 541 L 100 568 L 70 568",
  // Physicality, bottom right
  "M 796 486 L 838 486 L 866 458",
  "M 718 564 L 718 584 L 750 584",
  "M 773 541 L 800 568 L 830 568",
];

function traceEnd(path: string): [number, number] {
  const nums = path.match(/-?\d+(\.\d+)?/g)!.map(Number);
  return [nums[nums.length - 2], nums[nums.length - 1]];
}

export default function PersonMap({ base, active, name, consultations, arms }: Props) {
  const line = "rgba(var(--wash), 0.3)";
  const shortName = name.length > 22 ? name.split(" ")[0] : name;
  const nameSize = Math.min(25, 290 / Math.max(shortName.length, 1));
  const personOn = active === "person";

  return (
    <svg
      viewBox="0 0 900 600"
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
