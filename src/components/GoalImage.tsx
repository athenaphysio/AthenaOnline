type Props = {
  url: string | null;
  className?: string;
};

// The patient's own goal picture (see 0066_programme_goal_image.sql) --
// null until they or David upload a real one (Phase 3/4, not built yet),
// so this always has to render something sensible rather than a broken
// image or blank space. Deliberately a plain, clearly-marked placeholder
// rather than a generated stand-in photo -- David supplies the real
// default.
export default function GoalImage({ url, className }: Props) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={className} />;
  }
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 10,
        background: "repeating-linear-gradient(135deg, var(--parchment, #eee0cf), var(--parchment, #eee0cf) 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 20px)",
        border: "1px dashed var(--border, #d9cfba)",
        fontSize: 11.5,
        color: "var(--muted, #7a716a)",
        lineHeight: 1.4,
      }}
    >
      Default goal photo, David to supply
    </div>
  );
}
