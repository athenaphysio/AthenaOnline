// Shared shapes and labels for Flows, the follow along movement programmes
// kept in their own Vault section (see 0099_flows.sql).

export type FlowCategory = "neurodynamic" | "everyday_task" | "mobility" | "breath" | "mind" | "recovery";
/** Where a flow sits on the client's Tools tab. Empty follows its type
 * (breath to Breath, neurodynamic to Nervous system, and so on). */
export type ToolsArea = "" | "breath" | "nervous" | "mind" | "recovery";
export type FlowBodyArea = "upper_limb" | "lower_limb" | "whole_body";
export type FlowStatus = "draft" | "filmed" | "live";
export type FlowSide = "" | "Left" | "Right" | "Both";

export type FlowMove = {
  name: string;
  seconds: number;
  breathSeconds: number;
  /** Optional breath pattern in seconds, written in-hold-out-hold, for
   * example "4-4-4-4" for box breathing or "4-0-6-0" for a long exhale.
   * When set it paces the breath instead of breathSeconds. */
  breathPattern: string;
  side: FlowSide;
  cue: string;
  exerciseId: string | null;
};

export type Flow = {
  id: string;
  title: string;
  category: FlowCategory;
  bodyArea: FlowBodyArea;
  entryPoint: string;
  summary: string;
  status: FlowStatus;
  vimeoUrl: string;
  notes: string;
  toolsArea: ToolsArea;
  moves: FlowMove[];
};

export const CATEGORY_LABELS: Record<FlowCategory, string> = {
  neurodynamic: "Neurodynamic",
  everyday_task: "Everyday task",
  mobility: "Mobility",
  breath: "Breath",
  mind: "Mind",
  recovery: "Recovery and sleep",
};

export const TOOLS_AREA_LABELS: Record<Exclude<ToolsArea, "">, string> = {
  breath: "Breath",
  nervous: "Nervous system",
  mind: "Mind",
  recovery: "Recovery",
};

export type BreathPhases = { inhale: number; holdIn: number; exhale: number; holdOut: number };

// Reads "4-4-4-4" (in, hold, out, hold). Two numbers ("4-6") mean in and
// out with no holds. Anything unreadable gives null.
export function parseBreathPattern(pattern: string): BreathPhases | null {
  const parts = pattern
    .trim()
    .split(/[\s,\-\/:]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length !== 2 && parts.length !== 4) return null;
  if (parts.some((n) => !Number.isFinite(n) || n < 0 || n > 60)) return null;
  const [inhale, a, b, c] = parts;
  const phases = parts.length === 2 ? { inhale, holdIn: 0, exhale: a, holdOut: 0 } : { inhale, holdIn: a, exhale: b, holdOut: c };
  if (phases.inhale <= 0 || phases.exhale <= 0) return null;
  return phases;
}

// Where in the breath the client is, t seconds into a move: the words to
// show and how full the pacer circle is (0 empty, 1 full). Uses the pattern
// when there is one, otherwise an even in and out over breathSeconds.
export function breathAt(move: Pick<FlowMove, "breathPattern" | "breathSeconds">, t: number): { word: string; fill: number } | null {
  const p = parseBreathPattern(move.breathPattern);
  if (p) {
    const cycle = p.inhale + p.holdIn + p.exhale + p.holdOut;
    let x = t % cycle;
    if (x < p.inhale) return { word: "Breathe in", fill: easeInOut(x / p.inhale) };
    x -= p.inhale;
    if (x < p.holdIn) return { word: "Hold", fill: 1 };
    x -= p.holdIn;
    if (x < p.exhale) return { word: "Breathe out", fill: 1 - easeInOut(x / p.exhale) };
    return { word: "Hold", fill: 0 };
  }
  if (move.breathSeconds > 0) {
    const ph = (t % move.breathSeconds) / move.breathSeconds;
    return { word: ph < 0.5 ? "Breathe in" : "Breathe out", fill: 0.5 - 0.5 * Math.cos(2 * Math.PI * ph) };
  }
  return null;
}

function easeInOut(x: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));
}

export const BODY_AREA_LABELS: Record<FlowBodyArea, string> = {
  upper_limb: "Upper limb",
  lower_limb: "Lower limb",
  whole_body: "Whole body",
};

export const STATUS_LABELS: Record<FlowStatus, string> = {
  draft: "Draft, not filmed",
  filmed: "Filmed",
  live: "Live for clients",
};

export const SIDES: FlowSide[] = ["", "Left", "Right", "Both"];

export function flowSeconds(moves: { seconds: number }[]): number {
  return moves.reduce((total, m) => total + (m.seconds > 0 ? m.seconds : 0), 0);
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type FlowRow = {
  id: string;
  title: string;
  category: FlowCategory;
  body_area: FlowBodyArea;
  entry_point: string | null;
  summary: string | null;
  status: FlowStatus;
  vimeo_url: string | null;
  notes: string | null;
  tools_area?: string | null;
};

type FlowMoveRow = {
  move_order: number;
  name: string;
  seconds: number;
  breath_seconds: number;
  breath_pattern?: string | null;
  side: FlowSide;
  cue: string | null;
  exercise_id: string | null;
};

export function flowFromRows(row: FlowRow, moveRows: FlowMoveRow[]): Flow {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    bodyArea: row.body_area,
    entryPoint: row.entry_point ?? "",
    summary: row.summary ?? "",
    status: row.status,
    vimeoUrl: row.vimeo_url ?? "",
    notes: row.notes ?? "",
    toolsArea: (["breath", "nervous", "mind", "recovery"].includes(row.tools_area ?? "") ? row.tools_area : "") as ToolsArea,
    moves: [...moveRows]
      .sort((a, b) => a.move_order - b.move_order)
      .map((m) => ({
        name: m.name,
        seconds: m.seconds,
        breathSeconds: m.breath_seconds,
        breathPattern: m.breath_pattern ?? "",
        side: m.side,
        cue: m.cue ?? "",
        exerciseId: m.exercise_id,
      })),
  };
}

export const FLOW_SELECT = "id, title, category, body_area, entry_point, summary, status, vimeo_url, notes, tools_area";
export const FLOW_MOVE_SELECT = "flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id";
