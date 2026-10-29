// What a client sees in the app, set per brand pack: the bottom toolbar
// and its tabs, which items appear on the home page, the sign-off at the
// foot of the home page, and the team shown on the Team tab. Safe to use
// in the browser and on the server.
//
// Anything a pack has not set falls back to DEFAULT_APP_LAYOUT, which is
// the Athena app exactly as it was before these switches existed: no
// toolbar, every home page item on, and Dr David Silver PhD's sign-off.

export const APP_TABS = [
  { key: "programme", label: "Programme", note: "Their exercise programme, week by week." },
  { key: "passport", label: "Passport", note: "My Passport, with released results only. Still needs the client's own passport switch on." },
  { key: "messages", label: "Messages", note: "The whole conversation with the care team." },
  { key: "me", label: "Me", note: "Their details, consent and anything waiting to be filled in." },
  { key: "team", label: "Team", note: "Meet your team: the people looking after them." },
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

export type TeamMember = { name: string; role: string; about: string };

export type AppLayout = {
  /** Show the bottom toolbar with Home and the chosen tabs. */
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
};

export const DEFAULT_APP_LAYOUT: AppLayout = {
  bottom_bar: false,
  tabs: { programme: true, passport: true, messages: true, me: true, team: true },
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
          return { name: clean(o.name, 80), role: clean(o.role, 120), about: clean(o.about, 600) };
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
  };
}

export type ToolbarTab = { key: "home" | AppTabKey; label: string; href: string };

// The tabs a client actually sees, in order. Home always comes first. The
// passport tab also needs the client's own passport switch. A pack with
// no toolbar still shows the original two tabs to a client whose passport
// is switched on, as before.
export function toolbarTabs(layout: AppLayout, passportEnabled: boolean): ToolbarTab[] {
  if (!layout.bottom_bar) {
    return passportEnabled
      ? [
          { key: "home", label: "My Programme", href: "/session" },
          { key: "passport", label: "My Passport", href: "/session/passport" },
        ]
      : [];
  }
  const out: ToolbarTab[] = [{ key: "home", label: "Home", href: "/session" }];
  if (layout.tabs.programme) out.push({ key: "programme", label: "Programme", href: "/session/programme" });
  if (layout.tabs.passport && passportEnabled) out.push({ key: "passport", label: "Passport", href: "/session/passport" });
  if (layout.tabs.messages) out.push({ key: "messages", label: "Messages", href: "/session/messages" });
  if (layout.tabs.me) out.push({ key: "me", label: "Me", href: "/session/me" });
  if (layout.tabs.team) out.push({ key: "team", label: "Team", href: "/session/team" });
  return out;
}
