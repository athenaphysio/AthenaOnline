import Image from "next/image";

type Props = {
  // Height of the logo itself in pixels; the white panel adds a little padding around it.
  height?: number;
  // Set false where the logo already sits on a light background and needs no panel.
  panel?: boolean;
  className?: string;
};

// The original Athena Physio logo (the red mark crossing ATHENA PHYSIO),
// used for all default Athena branding in place of the old figure mark with
// typed text beside it. It sits on a small white panel by default so the red
// mark stays visible on the crimson banners and the dark clinic canvas.
const RATIO = 1000 / 568;

export default function AthenaLogo({ height = 30, panel = true, className }: Props) {
  const width = Math.round(height * RATIO);
  const img = <Image src="/brand/athena-logo.png" alt="Athena Physio" width={width} height={height} priority />;
  if (!panel) return <span className={className} style={{ display: "inline-flex" }}>{img}</span>;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${Math.round(height * 0.12)}px ${Math.round(height * 0.3)}px`,
        borderRadius: Math.max(6, Math.round(height * 0.25)),
        background: "#fff",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
        flexShrink: 0,
      }}
    >
      {img}
    </span>
  );
}
