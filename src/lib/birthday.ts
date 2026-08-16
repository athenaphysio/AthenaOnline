// Month/day only, deliberately ignoring year -- date_of_birth is a plain
// Postgres date (always parses as UTC midnight), so both sides compare on
// UTC components to stay consistent with each other regardless of the
// server's own local timezone.
export function isBirthdayToday(dateOfBirth: string): boolean {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  return dob.getUTCMonth() === today.getUTCMonth() && dob.getUTCDate() === today.getUTCDate();
}
