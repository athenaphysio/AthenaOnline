import Image from "next/image";

type Props = {
  // Default suits a badge/tag; pass a larger size for a heading-scale name.
  size?: number;
};

// The small white circle carrying the Athena mark, shown directly before
// a membership tier's name wherever one appears (membership page, clinic
// patient badges, the messages inbox). Sits inline via vertical-align
// rather than requiring its parent to be a flex container, so it can drop
// into plain text as easily as into an existing flex row.
export default function TierBadgeIcon({ size = 18 }: Props) {
  const markSize = Math.round(size * 0.62);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flexShrink: 0,
        overflow: "hidden",
        borderRadius: "50%",
        background: "#fff",
        border: "1px solid var(--crimson)",
        verticalAlign: "middle",
        marginRight: 5,
        marginBottom: 2,
      }}
    >
      {/* The mark's own artwork isn't optically centred in its square
          canvas -- nudged slightly left and down so it reads as centred
          inside the circle rather than merely centred by its own bounds. */}
      <Image
        src="/icons/athena-mark.png"
        alt=""
        width={markSize}
        height={markSize}
        style={{ transform: "translate(-4.6%, 6.6%)" }}
      />
    </span>
  );
}
