"use client";

import { useState } from "react";

type Props = {
  drillNames: string[];
  /** Left padding to line up with whatever sits above it -- the picker
   * row's thumbnail is wider than a plain card's title, so the two
   * contexts want different indents. */
  indent?: number;
};

// The Phase 2 "quick drill list" -- names only, no sets/reps/video/notes,
// so David can confirm what's in a block from the library itself in under
// a second, without opening the full block editor. Self-contained (own
// expanded state), so it drops straight into any server-rendered list or
// picker row without that parent needing to track which card is open.
export default function DrillListToggle({ drillNames, indent = 56 }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (drillNames.length === 0) return null;

  return (
    <div style={{ padding: `0 8px 4px ${indent}px` }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setExpanded((prev) => !prev);
        }}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          font: "inherit",
          fontSize: 11.5,
          fontWeight: 600,
          color: "var(--accent-content)",
          cursor: "pointer",
        }}
        aria-expanded={expanded}
      >
        {expanded ? "Hide drills" : `Show drills (${drillNames.length})`}
      </button>

      {expanded && (
        <ul style={{ padding: 0, margin: "4px 0 0", listStyle: "none" }}>
          {drillNames.map((n, i) => (
            <li key={i} style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.7 }}>
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
