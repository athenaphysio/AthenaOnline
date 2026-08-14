export type ShopSection = {
  slug: string;
  name: string;
  // Doubles as the Explore card's strapline (see ExploreSection.tsx) and
  // the section's own page tagline -- placeholder copy for David to
  // rewrite, same as the accent colours and tile image below.
  tagline: string;
  // Primary accent colour for this section's own page header. No longer
  // used for the Explore tile itself, which is a fixed dark-crimson info
  // box on every card regardless of section (see athena_explore_cards_
  // mockup.html) -- kept here since /shop/[slug]'s own header still uses it.
  accent: string;
  // Tint used for the section page header's background gradient.
  accentSoft: string;
  // Text colour that reads clearly on top of the accent.
  onAccent: string;
  // Cover image -- either David's own real photo, or (for the three
  // moved-under-Free-Resources sections) still the original abstract
  // placeholder graphic, not yet resupplied.
  image: string;
  // True once this card's image has the section name baked into the photo
  // itself (Atomic Sports, Athena Wellbeing) -- suppresses the on-image
  // title in the Explore card's info box so the name doesn't appear twice.
  // Left false/unset for a plain photo or placeholder graphic, which still
  // needs the rendered title.
  hasBakedInTitle?: boolean;
  // Where this card's Explore tile links -- defaults to /shop/{slug} if
  // unset. Free Resources is the one exception, its own hub page rather
  // than the standard product-listing template.
  href?: string;
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
// by adding an entry here, nothing else needs to change. "free-resources"
// is the one exception -- see EXPLORE_TILE_SLUGS below.
export const SHOP_SECTIONS: ShopSection[] = [
  {
    slug: "free-resources",
    name: "Free Resources",
    tagline: "Guides, videos and downloads to support you between sessions.",
    accent: "#6b1111",
    accentSoft: "#8a2423",
    onAccent: "#ffffff",
    image: "/shop/free-resources-cover.jpg",
    href: "/shop/free-resources",
  },
  {
    slug: "atomic-sports",
    name: "Atomic Sports",
    tagline: "Strength and conditioning for athletes.",
    accent: "#111111",
    accentSoft: "#2b2b2b",
    onAccent: "#ffffff",
    image: "/shop/atomic-sports-cover.jpg",
    hasBakedInTitle: true,
  },
  {
    slug: "athena-wellbeing",
    name: "Athena Wellbeing",
    tagline: "Movement for everyday life.",
    accent: "#6b7d5e",
    accentSoft: "#8a9a7d",
    onAccent: "#1c1c1c",
    image: "/shop/athena-wellbeing-cover.jpg",
    hasBakedInTitle: true,
    postFinishSuggestion: "helps you keep the progress.",
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
    slug: "rugby-resources",
    name: "Rugby Resources",
    tagline: "Rugby-specific strength, prevention and return to play.",
    accent: "#4A1520",
    accentSoft: "#6B2530",
    onAccent: "#ffffff",
    image: "/shop/rugby-resources.svg",
  },
  {
    slug: "pool-rehab-resources",
    name: "Pool Rehab Resources",
    tagline: "Rehab and conditioning in the water.",
    accent: "#1B6B75",
    accentSoft: "#2E8A94",
    onAccent: "#ffffff",
    image: "/shop/pool-rehab-resources.svg",
  },
  {
    slug: "mobility-resources",
    name: "Mobility Resources",
    tagline: "Everyday range of motion and ease of movement.",
    accent: "#8A6D3B",
    accentSoft: "#A8895A",
    onAccent: "#ffffff",
    image: "/shop/mobility-resources-cover.jpg",
  },
];

// The top-level Explore grid: Free Resources, Atomic Sports, Athena
// Wellbeing, Athena Concussion. Rugby/Pool/Mobility Resources moved under
// Free Resources instead of sitting here as their own tiles -- they were
// empty top-level entries (no programmes configured for any of the three),
// duplicating what's really one "resources" destination.
export const EXPLORE_TILE_SLUGS = ["free-resources", "atomic-sports", "athena-wellbeing", "athena-concussion"];

// The three sections now reached through the Free Resources hub page
// rather than the Explore top level -- see src/app/shop/free-resources/page.tsx.
export const FREE_RESOURCE_SLUGS = ["rugby-resources", "pool-rehab-resources", "mobility-resources"];

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
