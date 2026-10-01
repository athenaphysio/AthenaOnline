import type { BlockCategory } from "@/lib/blockCategory";

export type ClinicNavItem = {
  href: string;
  label: string;
  category?: BlockCategory;
};

export type ClinicNavGroup = {
  heading: string;
  items: ClinicNavItem[];
};

// The content types a builder's own palette can add while it's open (see
// BuilderPaletteContext and builderPalette.ts, which key off these same
// hrefs) -- also the sidebar's own Library group when nothing is being
// built.
export const LIBRARY_ITEMS: ClinicNavItem[] = [
  { href: "/clinic/workouts", label: "Workouts" },
  { href: "/clinic/blocks", label: "Blocks" },
  { href: "/clinic/exercises", label: "Exercises" },
  { href: "/clinic/blocks/activation", label: "Activations", category: "activation" },
  { href: "/clinic/blocks/injury-prevention", label: "Injury Prevention", category: "injury_prevention" },
  { href: "/clinic/cardio", label: "Cardio", category: "cardio" },
];

// The persistent left nav's full contents, grouped under five headings --
// see the Step 3 "tidy the clinician layout" brief. Each heading collapses
// independently on its own (ClinicSidebar.tsx) so the rail stays usable on
// a phone without ever needing to scroll sideways.
export const CLINIC_NAV_GROUPS: ClinicNavGroup[] = [
  { heading: "Clients", items: [{ href: "/clinic", label: "Clients" }] },
  { heading: "Messages", items: [{ href: "/clinic/messages", label: "Messages" }] },
  { heading: "Library", items: LIBRARY_ITEMS },
  {
    heading: "Programmes",
    items: [
      { href: "/clinic/programmes", label: "Programmes" },
      { href: "/clinic/programme-templates", label: "Programme Templates" },
      { href: "/clinic/forms", label: "Forms" },
    ],
  },
  {
    heading: "Settings",
    items: [
      { href: "/clinic/vault", label: "Vault" },
      { href: "/clinic/tools", label: "Tools" },
      { href: "/clinic/staff", label: "Staff" },
      { href: "/clinic/registrations", label: "Registrations" },
      { href: "/clinic/access-windows", label: "Access windows" },
      { href: "/clinic/purchases", label: "Purchases" },
    ],
  },
];

// Longest-prefix match wins (Activations/Injury Prevention must beat the
// plain Blocks entry, since /clinic/blocks/activation also starts with
// /clinic/blocks; every other page under /clinic falls back to Clients,
// which is also the correct answer for pages with no row of their own,
// such as a patient's own record) -- returns the href of whichever nav row
// should show as active for a given pathname, or null if nothing matches.
export function activeNavHref(pathname: string): string | null {
  const all = CLINIC_NAV_GROUPS.flatMap((g) => g.items);
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
  if (pathname.startsWith("/clinic/vault/running-ladders")) return "/clinic/vault/running-ladders";
  return null;
}
