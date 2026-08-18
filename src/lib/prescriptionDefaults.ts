// The starting point for a newly added non-cardio drill, so a fresh row
// opens with a sensible prescription rather than five blank boxes. David
// changes any of it per exercise as normal; this only decides what is
// already in the boxes.
//
// Cardio is deliberately excluded. A cardio block carries its own
// structure (duration, intervals, rest, intensity) and has no concept of
// sets or reps, so these would be meaningless there.
export const PRESCRIPTION_DEFAULTS = {
  sets: 3,
  reps: 6,
  hold_seconds: 0,
  percent_max: 75,
  // "3x/week", not "3x per week": every frequency already written in the
  // app uses this form ("2x/week each side", "2-3x/week"), and this text
  // is read by clients, so a second phrasing for the same thing would be
  // the odd one out.
  frequency: "3x/week",
} as const;
