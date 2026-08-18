import type { BlockCategory } from "@/lib/blockCategory";

export type ClinicNavItem = {
  href: string;
  label: string;
  category?: BlockCategory;
};

// The persistent left nav's full contents, top to bottom. Replaces the old
// Content hub's 11-tile grid and every spoke page's "← Content" back-link
// -- see the Phase 2 brief. Category is set only for the entries that map
// onto a single block category (used to draw the small coloured dot); the
// rest are multi-category or not a block-category concept at all.
export const CLINIC_NAV_PRIMARY: ClinicNavItem[] = [
  { href: "/clinic/workouts", label: "Workouts" },
  { href: "/clinic/blocks/activation", label: "Activations", category: "activation" },
  { href: "/clinic/blocks/injury-prevention", label: "Injury Prevention", category: "injury_prevention" },
  { href: "/clinic/blocks", label: "Blocks" },
  { href: "/clinic/exercises", label: "Exercises" },
  { href: "/clinic/cardio", label: "Cardio", category: "cardio" },
  { href: "/clinic/programmes", label: "Programmes" },
  { href: "/clinic/programme-templates", label: "Programme Templates" },
];

// Everything that used to be listed here one page at a time -- equipment,
// programme phases, email templates, Meet David & Friends -- is now a tab
// inside Vault, so the rail carries a single Vault row instead of four
// shortcuts into the same place. Vault has no sidebar of its own (see
// ClinicShell), so this is how you get there.
export const CLINIC_NAV_SECONDARY: ClinicNavItem[] = [
  { href: "/clinic/forms", label: "Forms" },
  { href: "/clinic/vault", label: "Vault" },
];

// Longest-prefix match first (Activations/Injury Prevention must win over
// the plain Blocks entry, since /clinic/blocks/activation also starts with
// /clinic/blocks) -- returns the href of whichever nav row should show as
// active for a given pathname, or null if nothing matches.
export function activeNavHref(pathname: string): string | null {
  const all = [...CLINIC_NAV_PRIMARY, ...CLINIC_NAV_SECONDARY];
  const matches = all.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  if (matches.length === 0) return null;
  return matches.reduce((longest, item) => (item.href.length > longest.href.length ? item : longest)).href;
}

// Where "+ New" should send the clinician for the section they're currently
// looking at -- null hides the button entirely rather than guessing when a
// section has no single-item "new" concept (Email templates: a fixed list
// of 8, nothing to create) or only an inline add control on its own list
// page (Exercises, Equipment, Programme phases: lands them on that list,
// ready to use the existing "+ Add" control there).
export function newHrefForPathname(pathname: string): string | null {
  if (pathname.startsWith("/clinic/blocks/activation")) return "/clinic/blocks/new?type=activation";
  if (pathname.startsWith("/clinic/blocks/injury-prevention")) return "/clinic/blocks/new?type=injury_prevention";
  if (pathname.startsWith("/clinic/blocks")) return "/clinic/blocks/new";
  if (pathname.startsWith("/clinic/workouts")) return "/clinic/workouts/new";
  if (pathname.startsWith("/clinic/cardio")) return "/clinic/cardio/new";
  if (pathname.startsWith("/clinic/programme-templates")) return "/clinic/programme-templates/new";
  if (pathname.startsWith("/clinic/programmes")) return "/clinic/programmes/new";
  if (pathname.startsWith("/clinic/forms")) return "/clinic/forms/new";
  if (pathname.startsWith("/clinic/exercises")) return "/clinic/exercises";
  if (pathname.startsWith("/clinic/vault/equipment")) return "/clinic/vault/equipment";
  if (pathname.startsWith("/clinic/vault/phase-tags")) return "/clinic/vault/phase-tags";
  return null;
}
