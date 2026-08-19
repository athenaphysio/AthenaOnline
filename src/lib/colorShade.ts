// Pure, isomorphic hex-colour helper -- no dependency, used to derive a
// darker second stop for a brand-pack-driven banner gradient (the crimson
// banner today is a hand-tuned 3-stop gradient of literal hex values, not
// generated from the --crimson variable, so a custom accent colour needs
// its own gradient built the same simple way rather than trying to
// reverse-engineer the original artist's exact stops).
export function darkenHex(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return hex;

  const r = Math.max(0, Math.min(255, Math.round(((num >> 16) & 0xff) * (1 - amount))));
  const g = Math.max(0, Math.min(255, Math.round(((num >> 8) & 0xff) * (1 - amount))));
  const b = Math.max(0, Math.min(255, Math.round((num & 0xff) * (1 - amount))));

  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
