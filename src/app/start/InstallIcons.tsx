// Small drawings of the buttons a client has to find on their phone, so the
// home screen instructions can show the button rather than name it. Each one
// is drawn in the text colour around it, at the size of the text.

type IconProps = { label: string };

function Chip({ label, children }: IconProps & { children: React.ReactNode }) {
  return (
    <span role="img" aria-label={label} style={{ display: "inline-flex", verticalAlign: "-0.32em", margin: "0 2px" }}>
      <svg width="1.45em" height="1.45em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

/** Apple's Share button: a square, open at the top, with an arrow coming up out of it. */
export function ShareIcon() {
  return (
    <Chip label="the Share button">
      <path d="M8.5 9.5H6.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" />
      <path d="M12 14V3" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
    </Chip>
  );
}

/** Safari's "more" button on iOS 26 and later: three dots in a circle. */
export function MoreDotsIcon() {
  return (
    <Chip label="the three dots button">
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="7.6" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="16.4" cy="12" r="1" fill="currentColor" stroke="none" />
    </Chip>
  );
}

/** The icon beside "Add to Home Screen" in Apple's share menu: a rounded square with a plus. */
export function AddSquareIcon() {
  return (
    <Chip label="the Add to Home Screen icon">
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </Chip>
  );
}

/** Chrome's and Firefox's menu button on Android: three dots stacked upright. */
export function VerticalDotsIcon() {
  return (
    <Chip label="the three dots menu">
      <circle cx="12" cy="5.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.6" fill="currentColor" stroke="none" />
    </Chip>
  );
}

/** Samsung Internet's menu button: three lines. */
export function MenuLinesIcon() {
  return (
    <Chip label="the menu button">
      <path d="M5 7h14M5 12h14M5 17h14" />
    </Chip>
  );
}
