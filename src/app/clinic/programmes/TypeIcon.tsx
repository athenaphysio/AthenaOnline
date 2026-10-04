import type { CardKind } from "@/lib/cardColours";

// Small outline icons, one per session type. Drawn in currentColor so the
// parent sets the colour.
export default function TypeIcon({ kind, size = 13 }: { kind: CardKind; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    style: { flexShrink: 0 },
  };
  switch (kind) {
    case "run":
      return (
        <svg {...common}>
          <circle cx="9.5" cy="3" r="1.4" />
          <path d="M6 14l2-4 2 1.5L9 7.5 6.5 6 4.5 8.5M9 7.5l2.5 1.5H14" />
        </svg>
      );
    case "strength":
      return (
        <svg {...common}>
          <path d="M2 6v4M4 4.5v7M12 4.5v7M14 6v4M4 8h8" />
        </svg>
      );
    case "bike":
      return (
        <svg {...common}>
          <circle cx="3.5" cy="11" r="2.5" />
          <circle cx="12.5" cy="11" r="2.5" />
          <path d="M3.5 11L7 5h3.5l2 6M7 5L9 11h3.5" />
        </svg>
      );
    case "swim":
      return (
        <svg {...common}>
          <path d="M1.5 10.5c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0M1.5 13.5c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0M9.5 7.5L7 5.5l3-2.5" />
          <circle cx="12" cy="4" r="1.2" />
        </svg>
      );
    case "rest":
      return (
        <svg {...common}>
          <path d="M12.5 9.5A5 5 0 016.5 3.5a5 5 0 106 6z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5" />
          <circle cx="8" cy="8" r="1" />
        </svg>
      );
  }
}
