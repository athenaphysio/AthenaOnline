export type ShopProgramme = {
  slug: string;
  sectionSlug: string;
  title: string;
  // One line, shown on the section page's card -- not a clinical claim,
  // just what it is. Placeholder copy for David to rewrite.
  summary: string;
  // Set while David is still building this one out -- the shop shows a
  // calm "In construction" placeholder and skips price/structure/buy
  // entirely rather than rendering with missing or fabricated content.
  comingSoon?: boolean;
  // Longer, shown on the programme's own page. Required once comingSoon is
  // false/unset.
  description?: string;
  // Whole pounds -- David sets the real number; this is a placeholder.
  priceGBP?: number;
  // Legacy static placeholder graphic, same approach as the section tiles --
  // only used as a fallback when no real cover_image_url exists on the
  // linked Programme Template. New entries shouldn't need this at all;
  // upload a real photo via the Template Builder instead.
  coverImage?: string;
  weeks?: number;
  sessionsPerWeek?: number;
  exerciseCount?: number;
  // What a typical week looks like -- one line per session/day.
  weeklyStructure?: string[];
  // A real exercise_id from the library, used to show one playable sample
  // exercise on the sales page before someone buys.
  sampleExerciseId?: string;
  notIncluded?: string[];
  // The real programme_templates row this listing hands over on purchase
  // (and, now, the source of a real cover image once one's uploaded there).
  // Left unset until David builds one -- the Stripe webhook still records
  // the purchase either way, it just can't create a programme without a
  // template id to copy from. Set this once a template exists.
  templateId?: string;
};

// One entry per sellable programme, grouped by the shop section it belongs
// to (src/lib/shopSections.ts). Hand-kept for now, same reasoning as the
// sections themselves -- David authors this content directly; add a
// programme by adding an entry here.
export const SHOP_PROGRAMMES: ShopProgramme[] = [
  {
    slug: "atomic-strength-and-speed",
    sectionSlug: "atomic-sports",
    title: "Atomic Strength and Speed",
    summary: "Self-serve, video-guided strength and speed training for athletes.",
    description:
      "A complete, video-guided strength and speed programme you follow on your own schedule. Every exercise is filmed and explained, built around the same principles Dr David Silver PhD uses in the clinic, adapted here for self-directed training rather than one-to-one supervision.",
    priceGBP: 149,
    coverImage: "/shop/atomic-strength-and-speed.svg",
    weeks: 8,
    sessionsPerWeek: 4,
    exerciseCount: 24,
    weeklyStructure: [
      "Session 1, lower body strength",
      "Session 2, speed and acceleration mechanics",
      "Session 3, upper body and trunk strength",
      "Session 4, power and reactive work",
    ],
    sampleExerciseId: "EX-075",
    notIncluded: [
      "No one-to-one contact with Dr David Silver PhD",
      "Not an individual assessment, so the programme is not adjusted to your own movement",
      "No testing days or cohort dates, entirely self-paced",
    ],
  },
  // The Atomic Sports sub-programmes below are placeholders: a name, a
  // section, and a link to a bare Programme Template ready to receive a
  // real cover image and, later, real content. No price, weeks, or
  // description is invented for any of these -- comingSoon: true tells both
  // shop pages to show a calm "in construction" state instead.
  {
    slug: "atomic-golf",
    sectionSlug: "atomic-sports",
    title: "Atomic Golf",
    summary: "Golf-specific strength, mobility and power training.",
    comingSoon: true,
    templateId: "a1000000-0000-4000-8000-000000000001",
  },
  {
    slug: "atomic-netball",
    sectionSlug: "atomic-sports",
    title: "Atomic Netball",
    summary: "Netball-specific conditioning, agility and landing mechanics.",
    comingSoon: true,
    templateId: "a1000000-0000-4000-8000-000000000002",
  },
  {
    slug: "atomic-hockey",
    sectionSlug: "atomic-sports",
    title: "Atomic Hockey",
    summary: "Hockey-specific strength, speed and rotational power.",
    comingSoon: true,
    templateId: "a1000000-0000-4000-8000-000000000003",
  },
  {
    slug: "atomic-padel",
    sectionSlug: "atomic-sports",
    title: "Atomic Padel",
    summary: "Padel-specific movement, rotational power and injury resilience.",
    comingSoon: true,
    templateId: "a1000000-0000-4000-8000-000000000004",
  },
  {
    slug: "atomic-martial-arts",
    sectionSlug: "atomic-sports",
    title: "Atomic Martial Arts",
    summary: "Strength, power and mobility training for martial artists.",
    comingSoon: true,
    templateId: "a1000000-0000-4000-8000-000000000005",
  },
  {
    slug: "atomic-basketball",
    sectionSlug: "atomic-sports",
    title: "Atomic Basketball",
    summary: "Basketball-specific power, agility and landing mechanics.",
    comingSoon: true,
    templateId: "a1000000-0000-4000-8000-000000000006",
  },
  {
    slug: "atomic-swimming",
    sectionSlug: "atomic-sports",
    title: "Atomic Swimming",
    summary: "Dryland strength and shoulder resilience training for swimmers.",
    comingSoon: true,
    templateId: "a1000000-0000-4000-8000-000000000007",
  },
];

export function getShopProgramme(sectionSlug: string, programmeSlug: string): ShopProgramme | undefined {
  return SHOP_PROGRAMMES.find((p) => p.sectionSlug === sectionSlug && p.slug === programmeSlug);
}

export function getShopProgrammesForSection(sectionSlug: string): ShopProgramme[] {
  return SHOP_PROGRAMMES.filter((p) => p.sectionSlug === sectionSlug);
}
