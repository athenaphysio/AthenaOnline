"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES, type Lang } from "@/i18n/languages";
import styles from "./screens/Screens.module.css";

// The client's choice of language, on the Me tab. Each language is listed
// in its own name, so a client can find theirs without reading English.
export default function LanguagePicker({ current, label, errorText }: { current: Lang; label: string; errorText: string }) {
  const router = useRouter();
  const [value, setValue] = useState<Lang>(current);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  async function choose(next: Lang) {
    const before = value;
    setValue(next);
    setFailed(false);
    const res = await fetch("/api/session/language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: next }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setValue(before);
      setFailed(true);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <label className={styles.muted} htmlFor="app-language" style={{ display: "block", marginBottom: 6 }}>
        {label}
      </label>
      <select
        id="app-language"
        value={value}
        disabled={pending}
        onChange={(e) => choose(e.target.value as Lang)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--charcoal)", fontSize: 15 }}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.nativeName}
            {l.code !== "en" ? ` (${l.englishName})` : ""}
          </option>
        ))}
      </select>
      {failed && (
        <p className={styles.muted} role="alert" style={{ marginTop: 8 }}>
          {errorText}
        </p>
      )}
    </div>
  );
}
