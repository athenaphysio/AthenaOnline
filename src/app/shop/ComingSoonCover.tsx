// A calm placeholder for a shop programme's cover image slot, used whenever
// no real photo has been uploaded yet (via the Template Builder) and no
// legacy static coverImage exists either. Neutral tokens rather than the
// section accent -- this should read as "a preview of what's coming," not
// mis-themed content pretending to be finished.
export default function ComingSoonCover() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, var(--sand), var(--parchment))",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-fraunces), serif",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--stone)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        In construction
      </span>
    </div>
  );
}
