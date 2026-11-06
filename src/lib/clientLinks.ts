// The links Dr David Silver PhD sends clients, for one brand pack. The
// standard pack uses the plain addresses; every other pack uses its own
// /join/<link name> addresses, which open in that pack's look.

export type ClientLinkKind = "app" | "register" | "register_intake" | "intake";

export type ClientLink = {
  kind: ClientLinkKind;
  label: string;
  note: string;
  url: string;
  message: string;
};

export function clientLinks(origin: string, slug: string | null): ClientLink[] {
  const path = (standard: string, joinSuffix: string) => (slug ? `${origin}/join/${slug}${joinSuffix}` : `${origin}${standard}`);
  const app = path("/start", "");
  const register = path("/register", "/register");
  const registerIntake = path("/register?then=intake", "/register-intake");
  const intake = path("/intake", "/intake");
  return [
    {
      kind: "app",
      label: "App login",
      note: "For a client who is set up in the app.",
      url: app,
      message: `Here is your link to the app. Open it on your phone and log in, then add it to your home screen so it is always to hand: ${app}`,
    },
    {
      kind: "register",
      label: "Registration",
      note: "For a new client: their details, GP, emergency contact and consent.",
      url: register,
      message: `Here is the registration form. It takes a few minutes, and your details come straight to me: ${register}`,
    },
    {
      kind: "register_intake",
      label: "Registration, then the Programme intake form",
      note: "For a new client who will not be having a one to one consultation. The intake form follows straight on, with their name and email carried across.",
      url: registerIntake,
      message: `Here is the registration form, followed by a few questions about your goals, your training and the time you have, so that I can build your programme. It takes about fifteen minutes in all: ${registerIntake}`,
    },
    {
      kind: "intake",
      label: "Programme intake form",
      note: "For a client who has already registered. They give their name and email, and the answers go straight into their record.",
      url: intake,
      message: `Here are a few questions about your goals, your training and the time you have, so that I can build your programme. It takes about ten minutes; please use the email you registered with: ${intake}`,
    },
  ];
}
