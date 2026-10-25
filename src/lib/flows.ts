// Shared shapes and labels for Flows, the follow along movement programmes
// kept in their own Vault section (see 0099_flows.sql).

export type FlowCategory = "neurodynamic" | "everyday_task" | "mobility" | "breath";
export type FlowBodyArea = "upper_limb" | "lower_limb" | "whole_body";
export type FlowStatus = "draft" | "filmed" | "live";
export type FlowSide = "" | "Left" | "Right" | "Both";

export type FlowMove = {
  name: string;
  seconds: number;
  breathSeconds: number;
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
  moves: FlowMove[];
};

export const CATEGORY_LABELS: Record<FlowCategory, string> = {
  neurodynamic: "Neurodynamic",
  everyday_task: "Everyday task",
  mobility: "Mobility",
  breath: "Breath",
};

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
};

type FlowMoveRow = {
  move_order: number;
  name: string;
  seconds: number;
  breath_seconds: number;
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
    moves: [...moveRows]
      .sort((a, b) => a.move_order - b.move_order)
      .map((m) => ({
        name: m.name,
        seconds: m.seconds,
        breathSeconds: m.breath_seconds,
        side: m.side,
        cue: m.cue ?? "",
        exerciseId: m.exercise_id,
      })),
  };
}

export const FLOW_SELECT = "id, title, category, body_area, entry_point, summary, status, vimeo_url, notes";
export const FLOW_MOVE_SELECT = "flow_id, move_order, name, seconds, breath_seconds, side, cue, exercise_id";
