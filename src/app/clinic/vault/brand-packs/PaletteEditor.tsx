"use client";

import styles from "./BrandPacks.module.css";
import type { BrandPalette } from "@/lib/brandPalette";

type ColourKey = Exclude<keyof BrandPalette, "body">;

// Plain names for each colour the app reads from a full palette, grouped
// the way David would think about them rather than the way the code does.
const GROUPS: { title: string; keys: { key: ColourKey; label: string }[] }[] = [
  {
    title: "Page and boxes",
    keys: [
      { key: "base", label: "Page background" },
      { key: "surface", label: "Cards and panels" },
      { key: "recessed", label: "Inside cards (inputs, tracks)" },
      { key: "line", label: "Borders" },
    ],
  },
  {
    title: "Writing",
    keys: [
      { key: "text", label: "Main text" },
      { key: "textSoft", label: "Secondary text" },
      { key: "textMuted", label: "Labels and small print" },
      { key: "accent", label: "Titles and buttons" },
    ],
  },
  {
    title: "Chart and highlight colours",
    keys: [
      { key: "sky", label: "Sky" },
      { key: "blue", label: "Blue" },
      { key: "pink", label: "Pink" },
      { key: "green", label: "Green" },
      { key: "coral", label: "Coral" },
      { key: "violet", label: "Violet" },
    ],
  },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

function mix(hex: string, toward: string, amount: number): string {
  if (!HEX.test(hex)) return hex;
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(toward.slice(1), 16);
  const ch = (n: number, s: number) => (n >> s) & 255;
  const out = [16, 8, 0].map((s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * amount));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// A sensible starting palette built from the pack's two main colours, so
// switching the full palette on never shows dark text on a dark page.
export function starterPalette(accent: string, background: string, theme: "light" | "dark"): BrandPalette {
  const acc = HEX.test(accent) ? accent.toLowerCase() : "#c2272d";
  const bg = HEX.test(background) ? background.toLowerCase() : theme === "dark" ? "#1a1a1a" : "#f2ede4";
  const shared = { sky: "#8fb8d8", pink: "#e3a3b0", green: "#a8c28a", coral: "#e9a39e", violet: "#6b5a8a", body: "" };
  if (theme === "dark") {
    return {
      ...shared,
      base: bg,
      surface: mix(bg, "#ffffff", 0.07),
      recessed: mix(bg, "#000000", 0.3),
      line: mix(acc, bg, 0.35),
      text: "#f4ede6",
      textSoft: "#d9cfc6",
      textMuted: "#a8998e",
      accent: acc,
      blue: mix(acc, "#ffffff", 0.15),
    };
  }
  return {
    ...shared,
    base: bg,
    surface: "#ffffff",
    recessed: mix(bg, "#000000", 0.05),
    line: mix(bg, "#000000", 0.15),
    text: "#1c1c1c",
    textSoft: "#4a4a4a",
    textMuted: "#7a746e",
    accent: acc,
    blue: mix(acc, "#000000", 0.1),
  };
}

export default function PaletteEditor({
  palette,
  onChange,
  accent,
  background,
  theme,
}: {
  palette: BrandPalette | null;
  onChange: (next: BrandPalette | null) => void;
  accent: string;
  background: string;
  theme: "light" | "dark";
}) {
  const on = palette !== null;
  const invalid = on ? GROUPS.flatMap((g) => g.keys).filter((k) => !HEX.test(palette[k.key])) : [];

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {(
          [
            { value: false, title: "Standard colours", note: "The app works out every shade from the accent and background colours above." },
            { value: true, title: "Full colour palette", note: "Set every colour yourself: page, cards, text, borders and chart colours." },
          ] as const
        ).map((opt) => {
          const chosen = on === opt.value;
          return (
            <button
              key={opt.title}
              type="button"
              aria-pressed={chosen}
              onClick={() => onChange(opt.value ? palette ?? starterPalette(accent, background, theme) : null)}
              className={`${styles.choice} ${chosen ? styles.choiceOn : ""}`}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{opt.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>{opt.note}</div>
            </button>
          );
        })}
      </div>

      {on && (
        <>
          {GROUPS.map((g) => (
            <div key={g.title} style={{ marginBottom: 14 }}>
              <div className={styles.miniHeading}>{g.title}</div>
              <div className={styles.paletteGrid}>
                {g.keys.map(({ key, label }) => (
                  <div key={key} className={styles.paletteItem}>
                    <input
                      type="color"
                      className={styles.colorSwatch}
                      value={HEX.test(palette[key]) ? palette[key] : "#000000"}
                      onChange={(e) => onChange({ ...palette, [key]: e.target.value })}
                      aria-label={label}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>{label}</div>
                      <input
                        className={styles.colorHexInput}
                        style={{ width: "100%", padding: "5px 8px", fontSize: 12.5 }}
                        value={palette[key]}
                        onChange={(e) => onChange({ ...palette, [key]: e.target.value.trim() })}
                        aria-label={`${label} code`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className={styles.miniHeading}>Body text font</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            {[
              { value: "", title: "Inter", note: "The app's usual text font." },
              { value: "figtree", title: "Figtree", note: "A rounder font, as used for Regenerate." },
              { value: "dmsans", title: "DM Sans", note: "Clean and minimal, as used by Nscale." },
            ].map((opt) => (
              <button
                key={opt.title}
                type="button"
                aria-pressed={palette.body === opt.value}
                onClick={() => onChange({ ...palette, body: opt.value })}
                className={`${styles.choice} ${palette.body === opt.value ? styles.choiceOn : ""}`}
                style={{ flex: "1 1 160px" }}
              >
                <div style={{ fontWeight: 600, fontSize: 14 }}>{opt.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>{opt.note}</div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onChange({ ...starterPalette(accent, background, theme), body: palette.body })}
            style={{ background: "none", border: "none", padding: 0, font: "inherit", fontSize: 13, color: "var(--muted)", cursor: "pointer", textDecoration: "underline" }}
          >
            Rebuild these colours from the accent and background colours
          </button>

          {invalid.length > 0 && (
            <p className={styles.uploadWarning} style={{ fontSize: 12.5 }}>
              {invalid.map((k) => k.label).join(", ")} {invalid.length === 1 ? "needs" : "need"} a six digit colour code such as
              #1A0A2E. The full palette is only used when every colour is filled in.
            </p>
          )}
        </>
      )}
    </div>
  );
}
