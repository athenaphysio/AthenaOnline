// Reads a CSV export of training sessions, such as the one the Concept2
// online logbook gives you (log.concept2.com, History, Export), into one
// session per row. No server code, so it can also run in the browser.
//
// Columns are found by name rather than position, so a file with columns
// in a different order, or a simple sheet with Date, Distance and Time
// columns, reads just as well.

export type CsvSession = {
  // Concept2's own Log ID, when the file has one, so a session already
  // synced from the logbook is recognised.
  c2LogId: number | null;
  date: string; // YYYY-MM-DD
  sport: "row" | "ski" | "bike" | "run";
  workoutType: string | null;
  distanceM: number;
  timeTenths: number;
  strokeRate: number | null;
  avgWatts: number | null;
  avgHr: number | null;
  dragFactor: number | null;
  calories: number | null;
  note: string | null;
};

export type CsvReadResult = { sessions: CsvSession[]; skipped: number; error: string | null };

/** Splits CSV text into rows of cells, honouring quotes. */
export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function key(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function num(text: string | undefined): number | null {
  if (text === undefined) return null;
  const n = Number(String(text).replace(/[, ]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 23:12.4, 1:02:03 or a plain number of seconds, as tenths of a second. */
function tenthsFrom(text: string | undefined): number | null {
  if (!text) return null;
  const t = text.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * 10);
  if (!/^\d+(:\d{1,2}){1,2}(\.\d+)?$/.test(t)) return null;
  const secs = t.split(":").map(Number).reduce((acc, n) => acc * 60 + n, 0);
  return Math.round(secs * 10);
}

/** 2026-11-04 07:30:00, 04/11/2026 or 4 Nov 2026, as YYYY-MM-DD. */
function dateFrom(text: string | undefined): string | null {
  if (!text) return null;
  const t = text.trim();
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  // Day first, as written in the UK.
  const uk = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
  if (uk) {
    const year = uk[3].length === 2 ? `20${uk[3]}` : uk[3];
    return `${year}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  }
  const parsed = new Date(t);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function sportFrom(text: string | undefined): CsvSession["sport"] {
  const t = key(text ?? "");
  if (t.includes("ski")) return "ski";
  if (t.includes("bike") || t.includes("cycl") || t.includes("ride")) return "bike";
  if (t.includes("run")) return "run";
  return "row";
}

// Possible names for each column, the first match winning. Concept2's own
// export names come first.
const COLUMNS: Record<string, string[]> = {
  logId: ["log id", "id"],
  date: ["date", "workout date", "start time", "date time"],
  description: ["description", "workout", "workout type", "name"],
  workTimeSeconds: ["work time seconds", "time seconds", "duration seconds"],
  workTime: ["work time formatted", "work time", "time", "duration"],
  restTimeSeconds: ["rest time seconds"],
  distance: ["work distance", "distance", "distance m", "metres", "meters"],
  strokeRate: ["stroke rate cadence", "stroke rate", "rate", "spm", "cadence"],
  watts: ["avg watts", "average watts", "watts", "power"],
  hr: ["avg heart rate", "average heart rate", "heart rate", "hr"],
  drag: ["drag factor", "drag"],
  calories: ["total cal", "calories", "cal"],
  type: ["type", "machine", "sport", "erg"],
  comments: ["comments", "notes", "note"],
};

export function readTrainingCsv(text: string): CsvReadResult {
  const rows = csvRows(text);
  if (rows.length < 2) return { sessions: [], skipped: 0, error: "That file doesn't have any sessions in it." };

  const header = rows[0].map(key);
  const col = (name: keyof typeof COLUMNS): number => {
    for (const option of COLUMNS[name]) {
      const i = header.indexOf(option);
      if (i >= 0) return i;
    }
    return -1;
  };
  const idx = Object.fromEntries(Object.keys(COLUMNS).map((k) => [k, col(k as keyof typeof COLUMNS)])) as Record<keyof typeof COLUMNS, number>;
  if (idx.date < 0 || idx.distance < 0 || (idx.workTime < 0 && idx.workTimeSeconds < 0)) {
    return {
      sessions: [],
      skipped: 0,
      error: "That file needs a date, a distance and a time column. The Concept2 logbook export has all three, so it may be a different file.",
    };
  }

  const sessions: CsvSession[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const cell = (i: number) => (i >= 0 ? r[i] : undefined);
    const date = dateFrom(cell(idx.date));
    const distanceM = num(cell(idx.distance));
    const timeTenths = idx.workTimeSeconds >= 0 ? tenthsFrom(cell(idx.workTimeSeconds)) : tenthsFrom(cell(idx.workTime));
    if (!date || !distanceM || !timeTenths) {
      skipped += 1;
      continue;
    }
    const rate = num(cell(idx.strokeRate));
    sessions.push({
      c2LogId: idx.logId >= 0 ? (num(cell(idx.logId)) ? Math.round(num(cell(idx.logId)) as number) : null) : null,
      date,
      sport: sportFrom(cell(idx.type)),
      workoutType: cell(idx.description)?.trim() || null,
      distanceM: Math.round(distanceM),
      timeTenths,
      strokeRate: rate ? Math.round(rate) : null,
      avgWatts: num(cell(idx.watts)) ? Math.round(num(cell(idx.watts)) as number) : null,
      avgHr: num(cell(idx.hr)) ? Math.round(num(cell(idx.hr)) as number) : null,
      dragFactor: num(cell(idx.drag)) ? Math.round(num(cell(idx.drag)) as number) : null,
      calories: num(cell(idx.calories)) ? Math.round(num(cell(idx.calories)) as number) : null,
      note: cell(idx.comments)?.trim() || null,
    });
  }
  if (sessions.length === 0) return { sessions, skipped, error: "No sessions could be read from that file." };
  return { sessions, skipped, error: null };
}

/** Same date, and distance and time within a hair, counts as the same session. */
export function sameSession(a: { date: string; distanceM: number; timeTenths: number }, b: { date: string; distanceM: number; timeTenths: number }): boolean {
  return a.date === b.date && Math.abs(a.distanceM - b.distanceM) <= Math.max(2, a.distanceM * 0.005) && Math.abs(a.timeTenths - b.timeTenths) <= Math.max(10, a.timeTenths * 0.005);
}
