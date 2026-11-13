import { DIARY_TIME_ZONE } from "@/lib/diary";
import { languageInfo, type Lang } from "./languages";
import type { Translator } from "./translate";

// Dates, days and times written the way a reader of each language expects,
// using the browser's own knowledge of each language, so day and month
// names never need translating by hand.

// 1 is Monday, 7 is Sunday. Capitalised, since it often starts a line.
export function weekdayName(isoDay: number, lang: Lang): string {
  const monday = new Date(Date.UTC(2024, 0, 1 + (isoDay - 1), 12));
  const name = monday.toLocaleDateString(languageInfo(lang).dateLocale, { weekday: "long", timeZone: "UTC" });
  return name.charAt(0).toLocaleUpperCase(languageInfo(lang).dateLocale) + name.slice(1);
}

export function slotWhen(iso: string, tr: Translator): string {
  const d = new Date(iso);
  const locale = languageInfo(tr.lang).dateLocale;
  const day = d.toLocaleDateString(locale, { timeZone: DIARY_TIME_ZONE, weekday: "long", day: "numeric", month: "long" });
  const time = d.toLocaleTimeString(locale, { timeZone: DIARY_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  return tr.t("practice.slotWhenAt", { day: day.charAt(0).toLocaleUpperCase(locale) + day.slice(1), time });
}

export function messageTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(languageInfo(lang).dateLocale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const LOCATION_KEYS = {
  home: "practice.locHome",
  office: "practice.locOffice",
  gym: "practice.locGym",
  hotel: "practice.locHotel",
  travel: "practice.locTravel",
} as const;

export function placeName(value: string, tr: Translator): string {
  return tr.t(LOCATION_KEYS[value as keyof typeof LOCATION_KEYS] ?? "practice.locHome");
}
