// Where to go after a clinician signs in. Only Roam Messenger may be asked
// for, so a link cannot send someone off to another site after login.
export function coachNext(raw: string | null | undefined): string {
  if (raw && /^\/roam-messenger(\/|\?|$)/.test(raw)) return raw;
  return "/coach";
}
