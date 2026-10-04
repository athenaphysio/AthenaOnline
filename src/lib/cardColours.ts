// The programme builder's colour system for session types. Strip, icon and
// library dot all read from here so they can never drift apart.
export type CardKind = "run" | "strength" | "bike" | "swim" | "other" | "rest";

export const CARD_COLOURS: Record<CardKind, string> = {
  run: "#9B1C1C",
  strength: "#1C1C1C",
  bike: "#B45309",
  swim: "#3E6A8A",
  other: "#6B6B6B",
  rest: "#C9C5BD",
};

export function cardKindOf(type: string | undefined | null): CardKind {
  return type === "run" || type === "strength" || type === "bike" || type === "swim" || type === "rest" ? type : "other";
}

// A library workout is either a strength-style workout or a cardio one.
export function libraryKindOf(kind: string | undefined | null): CardKind {
  return kind === "cardio" ? "run" : "strength";
}
