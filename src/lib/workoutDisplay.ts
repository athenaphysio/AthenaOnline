import { formatDuration } from "@/lib/rowing/zones";

// One plain line of numbers for an uploaded workout, shared by the client's
// page and the clinic record so both read the same.

export type WorkoutRow = {
  sport: string;
  duration_seconds: number;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_power: number | null;
  avg_cadence: number | null;
};

export function cadenceText(sport: string, cadence: number | null): string | null {
  if (!cadence) return null;
  if (sport === "row") return `${cadence} strokes a minute`;
  // FIT files count running cadence per leg; people think in steps.
  if (sport === "run") return `${cadence * 2} steps a minute`;
  return `${cadence} rpm`;
}

export function paceText(sport: string, distance: number | null, seconds: number): string | null {
  if (!distance || distance <= 0) return null;
  const m = Math.floor;
  if (sport === "row") {
    const s = (seconds * 500) / distance;
    return `${m(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")} /500m`;
  }
  if (sport === "run") {
    const s = (seconds * 1000) / distance;
    return `${m(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")} /km`;
  }
  if (sport === "ride") return `${((distance / seconds) * 3.6).toFixed(1)} km/h`;
  return null;
}

export function workoutLine(w: WorkoutRow): string {
  const parts = [
    formatDuration(w.duration_seconds),
    w.distance_m ? (w.distance_m >= 1000 ? `${(w.distance_m / 1000).toFixed(2)} km` : `${w.distance_m}m`) : null,
    paceText(w.sport, w.distance_m, w.duration_seconds),
    w.avg_power ? `${w.avg_power} W average` : null,
    w.avg_hr ? `heart rate ${w.avg_hr} average${w.max_hr ? `, ${w.max_hr} max` : ""}` : null,
    cadenceText(w.sport, w.avg_cadence),
  ];
  return parts.filter(Boolean).join(", ");
}

export function whenText(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}
