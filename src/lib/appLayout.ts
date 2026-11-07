// What a client sees in the app, set per brand pack: the bottom toolbar
// and its tabs, which items appear on the home page, the sign-off at the
// foot of the home page, and the team shown on the Team tab. Safe to use
// in the browser and on the server.
//
// Anything a pack has not set falls back to DEFAULT_APP_LAYOUT: every tab
// and home page item on, and Dr David Silver PhD's sign-off. Every client
// has the bottom toolbar; a pack only chooses which tabs go on it.

import { normalisePalette, type BrandPalette } from "./brandPalette";

export const APP_TABS = [
  { key: "programme", label: "Programme", note: "Their exercise programme, week by week." },
  { key: "passport", label: "Passport", note: "My Passport, with released results only. Still needs the client's own passport switch on." },
  { key: "messages", label: "Messages", note: "The whole conversation with the care team." },
  { key: "me", label: "Me", note: "Their details, consent and anything waiting to be filled in." },
  { key: "team", label: "Team", note: "Meet your team: the people looking after them." },
  { key: "tools", label: "Tools", note: "Breath, nervous system and mind resources they can open any time. Shows the Flows marked Live in the Vault." },
] as const;

export type AppTabKey = (typeof APP_TABS)[number]["key"];

export const HOME_ITEMS = [
  { key: "forms", label: "Questionnaires and forms waiting" },
  { key: "birthday", label: "Birthday message" },
  { key: "memberships", label: "Memberships" },
  { key: "equipment", label: "Recommended equipment" },
  { key: "booking", label: "Book an appointment" },
  { key: "resources", label: "Free resources" },
  { key: "explore", label: "Explore" },
  { key: "suggestions", label: "Suggestions" },
  { key: "buy_outright", label: "One-off payment to keep a programme" },
  { key: "meet_david", label: "Meet David and friends" },
] as const;

export type HomeItemKey = (typeof HOME_ITEMS)[number]["key"];

export const SIGNOFFS = [
  { key: "david", label: "Dr David Silver PhD", note: "The usual Athena sign-off." },
  { key: "team", label: "The team", note: "Signed by the team named on the Team tab." },
  { key: "none", label: "No sign-off", note: "Nothing at the foot of the home page." },
] as const;

export type SignoffKey = (typeof SIGNOFFS)[number]["key"];

/** photo: an image address, either uploaded to the clinic's image store or
 * one of the app's own pictures (starting with /). Empty shows initials. */
export type TeamMember = { name: string; role: string; about: string; photo: string };

export type AppLayout = {
  /** No longer read: every client has the bottom toolbar now. Kept so
   * packs saved with it still load cleanly. */
  bottom_bar: boolean;
  tabs: Record<AppTabKey, boolean>;
  home: Record<HomeItemKey, boolean>;
  signoff: SignoffKey;
  /** For example "The Regenerate team". Used by the team sign-off and the Team page. */
  team_name: string;
  team: TeamMember[];
  /** Messaging is part of the package, so clients can message freely
   * without a membership. */
  messaging_included: boolean;
  /** The "Something not feeling right? Message David" line under each
   * programme, for everyone on this pack. Off by default; a client's own
   * switch can also turn it on just for them. */
  programme_messages: boolean;
  /** The pack's own app, if it has one (for example ROAM for Regenerate):
   * its name, the line beneath it, and its logo, shown on the login page
   * under the brand's own logo. Empty when the pack has no app of its own. */
  app_name: string;
  app_strapline: string;
  app_logo: string;
  /** The same logo for a dark page, such as the client's record in the
   * clinic. Empty uses app_logo everywhere. */
  app_logo_on_dark: string;
  /** The short line beside the brand's logo under the client's greeting on
   * their home screen, for example "Measure. Move. Recover.". Empty shows
   * the logo alone. Standard Athena keeps David's photo and "Let's Move". */
  home_tagline: string;
  /** The picture beside the client's greeting, in place of David's photo.
   * Empty uses the brand's logo mark. */
  greeting_image: string;
  /** A finished, full-square home screen icon for the pack's app. Empty
   * draws the icon from the logo mark on the background colour. */
  app_icon: string;
  /** An optional seamless pattern tiled faintly across the whole dark
   * page behind everything, for example water ripples for Atomic Rowing.
   * Empty keeps the plain gradient canvas. */
  canvas_pattern: string;
  /** How big each repeat of the canvas pattern is drawn, as CSS, for
   * example "560px auto" for a small motif or "max(100vw, 900px) auto" for
   * a photo that should fill the screen. Empty uses "560px auto". */
  canvas_pattern_size: string;
  /** Optional tall images repeated down the left and right edges of the
   * dark page, scrolling with it, for example the Atomic Rowing rowers.
   * Empty shows nothing at the edges. */
  side_pattern_left: string;
  side_pattern_right: string;
  /** The pack's full colour palette (see brandPalette.ts), for a pack whose
   * look goes beyond one accent colour. Empty keeps the standard look. */
  palette: BrandPalette | null;
  /** The pack's own link name, so its join link is /join/<link_name>, for
   * example /join/concussion. Empty uses the pack's name instead. */
  link_name: string;
  /** The passport is always part of this brand's programme (Regenerate),
   * so the clinic shows it for every client on the pack. Otherwise it
   * follows each client's own passport switch. */
  passport_always: boolean;
};

export const DEFAULT_APP_LAYOUT: AppLayout = {
  bottom_bar: true,
  tabs: { programme: true, passport: true, messages: true, me: true, team: true, tools: true },
  home: {
    forms: true,
    birthday: true,
    memberships: true,
    equipment: true,
    booking: true,
    resources: true,
    explore: true,
    suggestions: true,
    buy_outright: true,
    meet_david: true,
  },
  signoff: "david",
  team_name: "",
  team: [],
  messaging_included: false,
  programme_messages: false,
  app_name: "",
  app_strapline: "",
  app_logo: "",
  app_logo_on_dark: "",
  home_tagline: "",
  greeting_image: "",
  app_icon: "",
  canvas_pattern: "",
  canvas_pattern_size: "",
  side_pattern_left: "",
  side_pattern_right: "",
  palette: null,
  link_name: "",
  passport_always: false,
};

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Reads whatever is stored, keeping only what is recognised and filling
// anything missing from the default.
export function normaliseAppLayout(raw: unknown): AppLayout {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const tabsRaw = (r.tabs && typeof r.tabs === "object" ? r.tabs : {}) as Record<string, unknown>;
  const homeRaw = (r.home && typeof r.home === "object" ? r.home : {}) as Record<string, unknown>;
  const tabs = { ...DEFAULT_APP_LAYOUT.tabs };
  for (const t of APP_TABS) if (typeof tabsRaw[t.key] === "boolean") tabs[t.key] = tabsRaw[t.key] as boolean;
  const home = { ...DEFAULT_APP_LAYOUT.home };
  for (const h of HOME_ITEMS) if (typeof homeRaw[h.key] === "boolean") home[h.key] = homeRaw[h.key] as boolean;
  const team = Array.isArray(r.team)
    ? (r.team as unknown[])
        .map((m) => {
          const o = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
          const photo = clean(o.photo, 600);
          const safePhoto = /^https:\/\/[^\s"']+$/.test(photo) || /^\/[A-Za-z0-9/_.-]+$/.test(photo) ? photo : "";
          return { name: clean(o.name, 80), role: clean(o.role, 120), about: clean(o.about, 600), photo: safePhoto };
        })
        .filter((m) => m.name)
        .slice(0, 12)
    : [];
  return {
    bottom_bar: typeof r.bottom_bar === "boolean" ? r.bottom_bar : DEFAULT_APP_LAYOUT.bottom_bar,
    tabs,
    home,
    signoff: SIGNOFFS.some((s) => s.key === r.signoff) ? (r.signoff as SignoffKey) : DEFAULT_APP_LAYOUT.signoff,
    team_name: clean(r.team_name, 80),
    team,
    messaging_included: typeof r.messaging_included === "boolean" ? r.messaging_included : false,
    programme_messages: r.programme_messages === true,
    app_name: clean(r.app_name, 40),
    app_strapline: clean(r.app_strapline, 120),
    app_logo: safeImagePath(clean(r.app_logo, 600)),
    app_logo_on_dark: safeImagePath(clean(r.app_logo_on_dark, 600)),
    home_tagline: clean(r.home_tagline, 60),
    greeting_image: safeImagePath(clean(r.greeting_image, 600)),
    app_icon: safeImagePath(clean(r.app_icon, 600)),
    canvas_pattern: safeImagePath(clean(r.canvas_pattern, 600)),
    canvas_pattern_size: /^[a-z0-9 ().,%-]+$/i.test(clean(r.canvas_pattern_size, 60)) ? clean(r.canvas_pattern_size, 60) : "",
    side_pattern_left: safeImagePath(clean(r.side_pattern_left, 600)),
    side_pattern_right: safeImagePath(clean(r.side_pattern_right, 600)),
    palette: normalisePalette(r.palette),
    link_name: linkSlug(clean(r.link_name, 60)).slice(0, 40),
    passport_always: r.passport_always === true,
  };
}

// A link name as it appears in the address: lower case letters, numbers and
// hyphens only, so "Athena Concussion" becomes athena-concussion.
export function linkSlug(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// An image address the page can safely show: a full https address or one
// of the app's own files.
function safeImagePath(v: string): string {
  return /^https:\/\/[^\s"']+$/.test(v) || /^\/[A-Za-z0-9/_.-]+$/.test(v) ? v : "";
}

export type ToolbarTab = { key: "home" | AppTabKey; label: string; href: string };

// The tabs a client actually sees, in order, on every screen of their app.
// Every client has the toolbar, and Home always comes first. The rest are
// the tabs switched on for the client's brand pack. The passport tab also
// needs the client's own passport switch, and the Team tab only appears
// once the pack has someone named on it, so no client opens an empty page.
export function toolbarTabs(layout: AppLayout, passportEnabled: boolean): ToolbarTab[] {
  const out: ToolbarTab[] = [{ key: "home", label: "Home", href: "/session" }];
  if (layout.tabs.programme) out.push({ key: "programme", label: "Programme", href: "/session/programme" });
  if (layout.tabs.passport && passportEnabled) out.push({ key: "passport", label: "Passport", href: "/session/passport" });
  if (layout.tabs.messages) out.push({ key: "messages", label: "Messages", href: "/session/messages" });
  if (layout.tabs.me) out.push({ key: "me", label: "Me", href: "/session/me" });
  if (layout.tabs.team && layout.team.length > 0) out.push({ key: "team", label: "Team", href: "/session/team" });
  if (layout.tabs.tools) out.push({ key: "tools", label: "Tools", href: "/session/tools" });
  return out;
}
