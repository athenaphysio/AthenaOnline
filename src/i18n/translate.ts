import { Fragment, createElement, type ReactNode } from "react";
import { DEFAULT_LANG, type Lang } from "./languages";
import { en, type Messages, type PartialMessages } from "./messages/en";
import { pl } from "./messages/pl";
import { es } from "./messages/es";
import { nb } from "./messages/nb";
import { sv } from "./messages/sv";
import { da } from "./messages/da";
import { pt } from "./messages/pt";

// Every word list, and whether a native speaker has checked it yet. A list
// that has not been checked shows the client a short note saying so. Set
// reviewed to true once a fluent speaker has signed it off.
const LISTS: Record<Lang, { messages: PartialMessages; reviewed: boolean }> = {
  en: { messages: en, reviewed: true },
  pl: { messages: pl, reviewed: false },
  es: { messages: es, reviewed: false },
  nb: { messages: nb, reviewed: false },
  sv: { messages: sv, reviewed: false },
  da: { messages: da, reviewed: false },
  pt: { messages: pt, reviewed: false },
};

export function isReviewed(lang: Lang): boolean {
  return LISTS[lang]?.reviewed ?? false;
}

type Section = keyof Messages;
export type MessageKey = { [S in Section]: `${S}.${keyof Messages[S] & string}` }[Section];
type Vars = Record<string, string | number>;

function lookup(lang: Lang, key: MessageKey): string {
  const [section, word] = key.split(".") as [Section, string];
  const chosen = (LISTS[lang]?.messages[section] as Record<string, string> | undefined)?.[word];
  if (chosen) return chosen;
  return (en[section] as Record<string, string>)[word] ?? key;
}

function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

export type Translator = {
  lang: Lang;
  // A plain sentence, with any {gaps} filled in.
  t: (key: MessageKey, vars?: Vars) => string;
  // A sentence with a {link} gap filled by a link (or any other element).
  rich: (key: MessageKey, parts: Record<string, ReactNode>, vars?: Vars) => ReactNode;
};

export function translator(lang: Lang = DEFAULT_LANG): Translator {
  const t = (key: MessageKey, vars?: Vars) => fill(lookup(lang, key), vars);
  const rich = (key: MessageKey, parts: Record<string, ReactNode>, vars?: Vars) => {
    const pieces = t(key, vars).split(/(\{\w+\})/);
    return createElement(
      Fragment,
      null,
      ...pieces.map((piece, i) => {
        const m = /^\{(\w+)\}$/.exec(piece);
        return createElement(Fragment, { key: i }, m && m[1] in parts ? parts[m[1]] : piece);
      }),
    );
  };
  return { lang, t, rich };
}
