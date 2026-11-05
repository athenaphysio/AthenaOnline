import { SPORT_TEXT, formatDuration, formatSplit, type Sport } from "@/lib/rowing/zones";

// Shared, client-safe shape of a client's path to their goal, drawn by
// GoalPathChart on both the clinic record and the client's own week.

export type PathPoint = { week: number; value: number; label: string; date: string; baseline?: boolean };

export type GoalPath = {
  sport: Sport;
  /** "time" for a distance event (seconds), "pace" for a timed one (seconds per unit). */
  measure: "time" | "pace";
  totalWeeks: number;
  currentWeek: number;
  points: PathPoint[];
  goal: { value: number; label: string } | null;
  /** The value the path expects now, when there is a goal. */
  expectedNow: number | null;
  eventName: string;
};

export function formatMeasure(path: Pick<GoalPath, "measure" | "sport">, value: number): string {
  return path.measure === "time" ? formatDuration(value) : `${formatSplit(value)} ${SPORT_TEXT[path.sport].unit}`;
}
