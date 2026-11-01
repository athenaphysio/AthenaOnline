// The password rules, kept in step with the Supabase sign-in settings
// (Authentication, Sign In / Providers, Email): at least 12 characters,
// with a lowercase letter, an uppercase letter, a number and a symbol, and
// never a password known from a data breach. If those settings change,
// change them here too, so every screen tells people the same thing.
//
// Shared by the client and server, so it imports nothing.

export const PASSWORD_MIN_LENGTH = 12;

export type PasswordRuleKey = "length" | "lower" | "upper" | "digit" | "symbol";

export const PASSWORD_RULES: { key: PasswordRuleKey; label: string; test: (pw: string) => boolean }[] = [
  { key: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (pw) => pw.length >= PASSWORD_MIN_LENGTH },
  { key: "upper", label: "A capital letter", test: (pw) => /[A-Z]/.test(pw) },
  { key: "lower", label: "A small letter", test: (pw) => /[a-z]/.test(pw) },
  { key: "digit", label: "A number", test: (pw) => /[0-9]/.test(pw) },
  { key: "symbol", label: "A symbol, such as # ? or %", test: (pw) => /[^A-Za-z0-9\s]/.test(pw) },
];

export const PASSWORD_INTRO =
  `Your password needs at least ${PASSWORD_MIN_LENGTH} characters, including a capital letter, a small letter, a number and a symbol. ` +
  "A short phrase of a few unrelated words, with a number and a symbol added, is both strong and easy to remember.";

export const PASSWORD_BREACHED_MESSAGE =
  "That password has appeared in a data breach somewhere else on the internet, so it is not safe to use here, even if you have never used it with us. " +
  "Please choose a different one that you have not used anywhere else.";

export const PASSWORD_WEAK_MESSAGE = "That password does not yet meet the requirements listed below it. Please adjust it and try again.";

export function unmetPasswordRules(pw: string): PasswordRuleKey[] {
  return PASSWORD_RULES.filter((r) => !r.test(pw)).map((r) => r.key);
}

export function passwordMeetsRules(pw: string): boolean {
  return unmetPasswordRules(pw).length === 0;
}

// Turns Supabase's refusal of a weak or breached password into plain words.
// Returns null for any other error, so the caller can handle it as before.
export function friendlyPasswordError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const e = error as { code?: string; reasons?: string[]; message?: string };
  const message = (e.message ?? "").toLowerCase();
  const reasons = Array.isArray(e.reasons) ? e.reasons : [];
  const isWeak = e.code === "weak_password" || reasons.length > 0 ||
    (message.includes("password") && (message.includes("weak") || message.includes("pwned") || message.includes("breach") || message.includes("guess")));
  if (!isWeak) return null;
  if (reasons.includes("pwned") || message.includes("pwned") || message.includes("breach") || message.includes("guess")) {
    return PASSWORD_BREACHED_MESSAGE;
  }
  return PASSWORD_WEAK_MESSAGE;
}
