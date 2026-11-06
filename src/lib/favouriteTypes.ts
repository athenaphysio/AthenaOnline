// The kinds of library item that can be starred. Shared by the favourites
// API route and the clinic's client-side favourites code.
export const FAVOURITE_TYPES = ["exercise", "block", "cardio_block", "workout", "programme", "cardio_programme"] as const;
export type FavouriteType = (typeof FAVOURITE_TYPES)[number];
