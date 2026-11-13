"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LANG, type Lang } from "./languages";
import { translator, type Translator } from "./translate";

// The client's language, handed to every interactive part of a screen at
// once, so nothing underneath needs it passed down by hand. Anything
// outside a provider (the clinic's own previews, for example) shows English.
const LanguageContext = createContext<Lang>(DEFAULT_LANG);

export function LanguageProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LanguageContext.Provider value={lang}>{children}</LanguageContext.Provider>;
}

export function useT(): Translator {
  const lang = useContext(LanguageContext);
  return useMemo(() => translator(lang), [lang]);
}
