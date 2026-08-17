import type { SlotType } from "@/lib/slotTypes";

// While a builder is open, the far-left rail stops being navigation and
// becomes a palette: clicking a content type changes what the library rail
// beside it offers, without leaving the programme being built. These are
// the types that can actually be added, keyed by the nav href they already
// use so the rail needs no second list.
export type PaletteKey = "workouts" | "activation" | "injury_prevention" | "blocks" | "exercises" | "cardio";

export const PALETTE_BY_HREF: Record<string, PaletteKey> = {
  "/clinic/workouts": "workouts",
  "/clinic/blocks/activation": "activation",
  "/clinic/blocks/injury-prevention": "injury_prevention",
  "/clinic/blocks": "blocks",
  "/clinic/exercises": "exercises",
  "/clinic/cardio": "cardio",
};

// What a builder can actually accept depends on what it is. A weekly
// calendar takes whole workouts onto days; a workout takes blocks,
// exercises and cardio. The rail only offers what the builder in front of
// you can take, so nothing on it is ever a dead end.
export const WORKOUT_CONTENT_KEYS: PaletteKey[] = [
  "activation",
  "injury_prevention",
  "blocks",
  "exercises",
  "cardio",
];
export const SCHEDULE_CONTENT_KEYS: PaletteKey[] = ["workouts"];

export type PickerTab = "blocks" | "exercises" | "cardio";

// The library rail already filters blocks by blocks.type through its own
// tab + type dropdown; the palette drives that same state rather than
// introducing a second filtering path. blockType "" means every block.
export function pickerStateFor(key: PaletteKey): { tab: PickerTab; blockType: string } {
  switch (key) {
    case "activation":
      return { tab: "blocks", blockType: "activation" };
    case "injury_prevention":
      return { tab: "blocks", blockType: "injury_prevention" };
    case "exercises":
      return { tab: "exercises", blockType: "" };
    case "cardio":
      return { tab: "cardio", blockType: "" };
    // "workouts" is never offered while a workout is the thing being built,
    // so it can only be a stale selection from the calendar; showing every
    // block is the sane thing to fall back to.
    case "workouts":
    case "blocks":
      return { tab: "blocks", blockType: "" };
  }
}

// "+ New block" creates whatever the palette is currently showing, so
// creating one while Activations is selected gives an activation block
// rather than an uncategorised one. With every block showing there is no
// category implied, so that keeps the previous default.
export function newBlockTypeFor(key: PaletteKey): SlotType {
  if (key === "activation") return "activation";
  if (key === "injury_prevention") return "injury_prevention";
  return "warm_up";
}
