export type ShopSection = {
  slug: string;
  name: string;
  // Short and descriptive, not a clinical claim -- placeholder copy for
  // David to rewrite, same as the accent colours and tile image below.
  tagline: string;
  // Primary accent colour for this section's tile and page header.
  accent: string;
  // Tint used for the tile's background gradient.
  accentSoft: string;
  // Text colour that reads clearly on top of the accent.
  onAccent: string;
  // Placeholder tile/header image -- an abstract graphic in the section's
  // own colours, not a stock photo standing in for real content. Swap for
  // a real photo (David's own, from Movement.so) by dropping it in
  // /public/shop and pointing this at the new path -- nothing else changes.
  image: string;
  // Set only on a section that's a genuine "what's next" once a client's
  // rehab block has run its course -- not a hard sell, so most sections
  // won't have one. When set, this is the second half of a single line the
  // landing page may show once someone finishes: "Finished your rehab?
  // {name} {postFinishSuggestion}." Shown at most once, never above the
  // client's own session (see src/app/session/page.tsx).
  postFinishSuggestion?: string;
};

// The shop's top level: a small, hand-kept list of branded sections, not a
// flat list of programmes. Each one gets its own tile and its own themed
// page at /shop/[slug] (see src/app/shop/[slug]/page.tsx) -- add a section
// by adding an entry here, nothing else needs to change.
export const SHOP_SECTIONS: ShopSection[] = [
  {
    slug: "atomic-sports",
    name: "Atomic Sports",
    tagline: "Strength and conditioning for athletes.",
    accent: "#111111",
    accentSoft: "#2b2b2b",
    onAccent: "#ffffff",
    image: "/shop/atomic-sports.svg",
  },
  {
    slug: "athena-concussion",
    name: "Athena Concussion",
    tagline: "Structured return to play and return to learn.",
    accent: "#1c3d5a",
    accentSoft: "#2e5478",
    onAccent: "#ffffff",
    image: "/shop/athena-concussion.svg",
  },
  {
    slug: "athena-wellbeing",
    name: "Athena Wellbeing",
    tagline: "Movement for everyday life.",
    accent: "#6b7d5e",
    accentSoft: "#8a9a7d",
    onAccent: "#1c1c1c",
    image: "/shop/athena-wellbeing.svg",
    postFinishSuggestion: "helps you keep the progress.",
  },
];

export function getShopSection(slug: string): ShopSection | undefined {
  return SHOP_SECTIONS.find((s) => s.slug === slug);
}

// The one section (if any) the landing page may point a client at once
// their scheduled programme has finished. First match wins -- if more than
// one section is ever flagged, that's a sign to build real matching rather
// than a reason to show more than one suggestion at once.
export function getPostFinishSuggestion(): ShopSection | undefined {
  return SHOP_SECTIONS.find((s) => s.postFinishSuggestion);
}
