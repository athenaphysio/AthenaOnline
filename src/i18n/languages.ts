// The languages a client can choose for their app. English is the master
// copy: every other language follows it, and any word not yet translated
// falls back to the English, so a client never sees a blank label.
//
// To add a language: add it here, add a word list in src/i18n/messages,
// register it in src/i18n/translate.ts, and add its code to the list allowed
// by the patients.language check in a new migration.

export const LANGUAGES = [
  { code: "en", englishName: "English", nativeName: "English", dateLocale: "en-GB" },
  { code: "pl", englishName: "Polish", nativeName: "Polski", dateLocale: "pl-PL" },
  { code: "es", englishName: "Spanish", nativeName: "Español", dateLocale: "es-ES" },
  { code: "nb", englishName: "Norwegian", nativeName: "Norsk (bokmål)", dateLocale: "nb-NO" },
  { code: "sv", englishName: "Swedish", nativeName: "Svenska", dateLocale: "sv-SE" },
  { code: "da", englishName: "Danish", nativeName: "Dansk", dateLocale: "da-DK" },
  { code: "pt", englishName: "Portuguese", nativeName: "Português", dateLocale: "pt-PT" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANG: Lang = "en";

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && LANGUAGES.some((l) => l.code === v);
}

export function languageInfo(lang: Lang) {
  return LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
}

// A date written the way a reader of that language expects it.
export function formatDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(languageInfo(lang).dateLocale, { day: "numeric", month: "long", year: "numeric" });
}
