// Pure types and helpers only -- no supabaseAdmin import here, so Client
// Components can import this freely (the Blocks and Sessions library grids,
// the Sessions builder's running total). The actual data fetch lives in
// vaultBlocksLibraryServer.ts, which does carry a server-only guard.

export type BlockCard =
  | {
      kind: "exercise";
      id: string;
      name: string;
      type: string;
      weeks: number;
      exerciseCount: number;
      previewNames: string[];
      // No per-exercise time data exists anywhere in the real schema (no
      // time-per-set or rest-between-sets field), so an exercise block's
      // single-sitting duration genuinely can't be calculated -- always
      // null, never guessed.
      durationSeconds: null;
      // Union of equipment tags across every exercise in the block (any
      // week), for the session equipment icon roll-up.
      equipmentIds: string[];
      // What this block is actually for -- Running, Hip Hinge, Lumbar
      // Stenosis -- a second, finer, David-managed classification on top
      // of Type. Cardio blocks don't carry these; Type doesn't really
      // apply to them either, so there's nothing to further classify.
      usageTagIds: string[];
      // Everywhere this block is currently used, so the library grid can
      // offer or refuse a delete without a second round trip -- see
      // blockUsage.ts. Not computed for a cardio block, which isn't part
      // of this delete feature.
      workoutCount: number;
      patientNames: string[];
    }
  | {
      kind: "cardio";
      id: string;
      name: string;
      category: string;
      tier: string | null;
      modality: string;
      summary: string;
      durationSeconds: number | null;
      // A cardio block has no exercises, so nothing to roll up -- always [].
      equipmentIds: string[];
      // Coach-facing only -- see cardioBlock.ts's CardioReviewStatus.
      reviewStatus: "pending" | "reviewed";
    };

const CARDIO_CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  return_to_run: "Return to Run",
  running_progression: "Running Progression",
  cycling_progression: "Cycling Progression",
};

export function cardioCategoryLabel(category: string): string {
  return CARDIO_CATEGORY_LABEL[category] ?? category;
}

const MODALITY_LABEL: Record<string, string> = {
  running: "Running",
  treadmill: "Treadmill",
  treadmill_walk: "Treadmill (walk)",
  outdoor_run: "Outdoor run",
  cycling: "Cycling",
  ski_erg: "Ski erg",
  row_erg: "Row erg",
  cross_trainer: "Cross trainer",
  any: "Any modality",
  other: "Other",
};

export function modalityLabel(modality: string): string {
  return MODALITY_LABEL[modality] ?? modality;
}

// Plain "12 min" / "1h 5min" label for a calculable cardio duration --
// shared formatting for the Blocks library card and the Sessions builder's
// running total.
export function formatDurationMinutes(seconds: number | null): string | null {
  if (!seconds) return null;
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}
