// Human Passport: shared definitions used by both the clinic screens and the
// client's My Passport screens. Nothing in here touches the database, so it
// is safe to import from anywhere.

export const PASSPORT_DOMAINS = [
  {
    key: "heart_recovery",
    name: "Heart and recovery",
    blurb: "How your heart and nervous system handle the load of your days, and how well you recover from it.",
    colour: "#9b1c1c",
  },
  {
    key: "sleep_energy",
    name: "Sleep and energy",
    blurb: "How well you recharge overnight, and how that shows up in your energy through the day.",
    colour: "#35618f",
  },
  {
    key: "blood",
    name: "Blood biomarkers",
    blurb: "What your blood panel tells us about metabolism, inflammation, hormones and the systems underneath.",
    colour: "#7d4f96",
  },
  {
    key: "gut",
    name: "Gut health",
    blurb: "The diversity and balance of your gut microbiome, which links to energy, mood and immunity.",
    colour: "#b45309",
  },
  {
    key: "body_movement",
    name: "Body and movement",
    blurb: "Strength, mobility, fitness and how confident you feel in what your body can do.",
    colour: "#0f766e",
  },
  {
    key: "mind_behaviour",
    name: "Mind and behaviour",
    blurb: "Stress, coping, readiness for change and the psychometric picture behind how you work and live.",
    colour: "#2e6f5c",
  },
] as const;

export type PassportDomainKey = (typeof PASSPORT_DOMAINS)[number]["key"];

export function domainByKey(key: string) {
  return PASSPORT_DOMAINS.find((d) => d.key === key) ?? null;
}

export const TIMEPOINTS = [
  { key: "baseline", label: "Baseline" },
  { key: "month_3", label: "3 months" },
  { key: "month_6", label: "6 months" },
  { key: "review", label: "Review" },
] as const;

export type TimepointKey = (typeof TIMEPOINTS)[number]["key"];

export function timepointLabel(key: string): string {
  return TIMEPOINTS.find((t) => t.key === key)?.label ?? key;
}

export type PassportMarker = {
  marker_key: string;
  domain: PassportDomainKey;
  panel: string | null;
  name: string;
  unit: string | null;
  explanation: string | null;
  range_low: number | null;
  range_high: number | null;
  optimal_low: number | null;
  optimal_high: number | null;
  better: "higher" | "lower" | "in_range";
  sort_order: number;
};

export type PassportResult = {
  id: string;
  marker_key: string;
  value: number;
  timepoint: TimepointKey;
  taken_on: string;
  source: string | null;
  clinician_note: string | null;
  status: "draft" | "released";
};

// ---------------------------------------------------------------------------
// Status of a single value against its ranges. Kept deliberately soft: the
// passport never shouts, and anything outside range is "worth a
// conversation", never an alarm.
// ---------------------------------------------------------------------------

export type RangeStatus = "optimal" | "in_range" | "worth_a_conversation" | "no_range";

export function rangeStatus(value: number, m: Pick<PassportMarker, "range_low" | "range_high" | "optimal_low" | "optimal_high">): RangeStatus {
  const hasRange = m.range_low != null || m.range_high != null;
  const hasOptimal = m.optimal_low != null || m.optimal_high != null;
  if (!hasRange && !hasOptimal) return "no_range";
  if (hasOptimal && within(value, m.optimal_low, m.optimal_high)) return "optimal";
  if (hasRange && within(value, m.range_low, m.range_high)) return "in_range";
  if (!hasRange && hasOptimal) return "in_range";
  return "worth_a_conversation";
}

function within(v: number, lo: number | null, hi: number | null) {
  return (lo == null || v >= lo) && (hi == null || v <= hi);
}

export const STATUS_STYLE: Record<RangeStatus, { label: string; colour: string; soft: string }> = {
  optimal: { label: "Optimal", colour: "#2e6f5c", soft: "#e5f0ec" },
  in_range: { label: "In range", colour: "#35618f", soft: "#e6edf5" },
  worth_a_conversation: { label: "Worth a conversation", colour: "#b45309", soft: "#f7ecd9" },
  no_range: { label: "Tracking", colour: "#7a716a", soft: "#f2ede4" },
};

// ---------------------------------------------------------------------------
// Change over time, always against the client's own earlier numbers.
// ---------------------------------------------------------------------------

export type Trend = "improving" | "steady" | "moving_away" | "first_reading";

// A change smaller than this share of the client's own baseline is treated as
// steady, so normal variation is not dressed up as progress or decline.
// PLACEHOLDER: the team still needs to agree a meaningful change per marker.
export const STEADY_BAND = 0.05;

export function trendFor(values: number[], m: Pick<PassportMarker, "better" | "optimal_low" | "optimal_high" | "range_low" | "range_high">): Trend {
  if (values.length < 2) return "first_reading";
  const first = values[0];
  const last = values[values.length - 1];
  const scale = Math.abs(first) > 0 ? Math.abs(first) : 1;
  if (Math.abs(last - first) / scale < STEADY_BAND) return "steady";

  if (m.better === "higher") return last > first ? "improving" : "moving_away";
  if (m.better === "lower") return last < first ? "improving" : "moving_away";

  // in_range: improving means getting closer to the middle of the optimal
  // band, or the healthy band when no optimal band has been set.
  const lo = m.optimal_low ?? m.range_low;
  const hi = m.optimal_high ?? m.range_high;
  if (lo == null && hi == null) return "steady";
  const target = lo != null && hi != null ? (lo + hi) / 2 : (lo ?? hi)!;
  return Math.abs(last - target) < Math.abs(first - target) ? "improving" : "moving_away";
}

export const TREND_WORDS: Record<Trend, string> = {
  improving: "Improving since your first reading",
  steady: "Holding steady",
  moving_away: "Moving away from where we want it, worth a conversation",
  first_reading: "First reading, your trend appears after the next measurement",
};

export function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toFixed(2)));
}

// ---------------------------------------------------------------------------
// The upload template: one CSV with fixed columns, the same for every
// provider. See passportTemplateCsv for the file David downloads.
// ---------------------------------------------------------------------------

export const TEMPLATE_COLUMNS = [
  "domain",
  "panel",
  "marker",
  "value",
  "unit",
  "range_low",
  "range_high",
  "optimal_low",
  "optimal_high",
  "better",
  "timepoint",
  "date",
  "source",
  "clinician_note",
] as const;

export function passportTemplateCsv(): string {
  const example = [
    ["heart_recovery", "", "Heart rate variability", "42", "ms", "", "", "", "", "higher", "baseline", "2026-11-05", "Firstbeat", ""],
    ["blood", "Inflammation", "hs-CRP", "1.4", "mg/L", "0", "3", "0", "1", "in_range", "baseline", "2026-11-05", "Randox", ""],
  ];
  return [TEMPLATE_COLUMNS.join(","), ...example.map((r) => r.join(","))].join("\n") + "\n";
}

export function markerKeyFor(domain: string, name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${domain}.${slug}`;
}

export type ParsedRow = {
  line: number;
  marker: Omit<PassportMarker, "explanation" | "sort_order">;
  result: { value: number; timepoint: TimepointKey; taken_on: string; source: string | null; clinician_note: string | null };
};

export type ParseOutcome = { rows: ParsedRow[]; problems: string[] };

// Reads the template CSV. Every problem is reported with its line number and
// nothing is saved until the whole file reads cleanly.
export function parsePassportCsv(text: string): ParseOutcome {
  const table = splitCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
  const problems: string[] = [];
  if (table.length === 0) return { rows: [], problems: ["The file is empty."] };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  for (const required of ["domain", "marker", "value", "timepoint", "date"]) {
    if (col(required) === -1) problems.push(`The column "${required}" is missing from the first row.`);
  }
  if (problems.length) return { rows: [], problems };

  const domainKeys = PASSPORT_DOMAINS.map((d) => d.key as string);
  const timepointKeys = TIMEPOINTS.map((t) => t.key as string);
  const rows: ParsedRow[] = [];

  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (name: string) => {
      const idx = col(name);
      return idx === -1 ? "" : (cells[idx] ?? "").trim();
    };
    const num = (name: string): number | null => {
      const raw = get(name);
      if (raw === "") return null;
      const n = Number(raw);
      if (Number.isNaN(n)) {
        problems.push(`Line ${line}: "${name}" should be a number but reads "${raw}".`);
        return null;
      }
      return n;
    };

    const domain = get("domain");
    const name = get("marker");
    const timepoint = get("timepoint");
    const date = get("date");
    const better = get("better") || "in_range";
    const value = num("value");

    if (!domainKeys.includes(domain)) problems.push(`Line ${line}: domain "${domain}" should be one of ${domainKeys.join(", ")}.`);
    if (!name) problems.push(`Line ${line}: the marker name is empty.`);
    if (value == null && get("value") === "") problems.push(`Line ${line}: the value is empty.`);
    if (!timepointKeys.includes(timepoint)) problems.push(`Line ${line}: timepoint "${timepoint}" should be one of ${timepointKeys.join(", ")}.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) problems.push(`Line ${line}: the date should look like 2026-11-05, but reads "${date}".`);
    if (!["higher", "lower", "in_range"].includes(better)) problems.push(`Line ${line}: "better" should be higher, lower or in_range.`);

    if (!domainKeys.includes(domain) || !name || value == null || !timepointKeys.includes(timepoint)) return;

    rows.push({
      line,
      marker: {
        marker_key: markerKeyFor(domain, name),
        domain: domain as PassportDomainKey,
        panel: get("panel") || null,
        name,
        unit: get("unit") || null,
        range_low: num("range_low"),
        range_high: num("range_high"),
        optimal_low: num("optimal_low"),
        optimal_high: num("optimal_high"),
        better: better as PassportMarker["better"],
      },
      result: {
        value,
        timepoint: timepoint as TimepointKey,
        taken_on: date,
        source: get("source") || null,
        clinician_note: get("clinician_note") || null,
      },
    });
  });

  return { rows: problems.length ? [] : rows, problems };
}

// A small CSV reader that copes with quoted cells, commas inside quotes and
// both Windows and Mac line endings, which is what Excel and Jisc exports use.
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
