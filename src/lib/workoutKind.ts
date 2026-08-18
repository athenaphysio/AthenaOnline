// A cardio workout is its own type of workout, not a tag on an ordinary
// one: David builds it separately, finds it in its own library, and it has
// its own Vault tab.
//
// It is a discriminator on workouts rather than its own table, because a
// cardio workout is still a session that gets assigned to a day, saved into
// a programme, and rendered to a client. A parallel table would mean a
// parallel workout_items, a parallel assignment path and a parallel session
// pipeline, for nothing a client would ever see. One pipeline underneath,
// two genuinely separate types everywhere it matters.
export type WorkoutKind = "standard" | "cardio";

export const WORKOUT_KINDS: { value: WorkoutKind; label: string; blurb: string }[] = [
  {
    value: "standard",
    label: "Workout",
    blurb: "Blocks, exercises and cardio pieces making up one session.",
  },
  {
    value: "cardio",
    label: "Cardio workout",
    blurb: "A session built from cardio pieces, for the conditioning side of a programme.",
  },
];

export function workoutKindLabel(kind: string): string {
  return WORKOUT_KINDS.find((k) => k.value === kind)?.label ?? "Workout";
}

// Anything unrecognised reads as a plain workout rather than disappearing
// from every library at once, which is the safer way for a bad value to
// fail.
export function cleanWorkoutKind(value: unknown): WorkoutKind {
  return value === "cardio" ? "cardio" : "standard";
}
