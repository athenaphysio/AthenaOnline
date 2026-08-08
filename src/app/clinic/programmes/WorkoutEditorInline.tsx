"use client";

import { useEffect, useRef, useState } from "react";
import WorkoutBuilder, { type ExerciseOption, type WorkoutItem } from "../workouts/WorkoutBuilder";
import type { BlockDetail } from "../builder/BlockGroupEditor";
import type { CardioBlockDetail } from "@/lib/cardioBlock";
import styles from "./WorkoutEditorInline.module.css";

type WorkoutDetailResponse = {
  id: string;
  name: string;
  high_load: boolean;
  items: WorkoutItem[];
  blockDetails: Record<string, BlockDetail>;
  cardioBlockDetails: Record<string, CardioBlockDetail>;
};

type Props = {
  workoutId: string;
  defaultBlockLengthWeeks: number;
  onSaved: (newName: string, highLoad: boolean) => void;
  /** "create" mounts a brand-new, not-yet-saved workout (used for an Open
   * programme's single workout when there's nothing to copy from) -- skips
   * the GET entirely rather than fetching an id that doesn't exist yet.
   * Defaults to "edit", the original (and only, until now) behaviour. */
  mode?: "create" | "edit";
  /** Only used in "create" mode, as the workout's starting name. */
  initialName?: string;
};

// Fetches the same data the standalone /clinic/workouts/[id] page assembles
// server-side, then mounts the same WorkoutBuilder -- this is the "opens
// from the calendar" entry point, not a separate editor.
export default function WorkoutEditorInline({
  workoutId,
  defaultBlockLengthWeeks,
  onSaved,
  mode = "edit",
  initialName = "",
}: Props) {
  const [data, setData] = useState<WorkoutDetailResponse | null>(null);
  const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // `mode` only matters for deciding *how to fetch on first mount* (skip the
  // GET entirely for a workout that doesn't exist yet). Captured once so
  // that a later mode flip -- e.g. "create" -> "edit" once the parent's
  // onSaved callback fires after the first successful save -- doesn't
  // re-trigger this effect and remount WorkoutBuilder underneath itself,
  // losing its own in-flight "Saved" confirmation state.
  const initialModeRef = useRef(mode);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    const workoutFetch: Promise<WorkoutDetailResponse & { error?: string }> =
      initialModeRef.current === "create"
        ? Promise.resolve({
            id: workoutId,
            name: initialName,
            high_load: false,
            items: [],
            blockDetails: {},
            cardioBlockDetails: {},
          })
        : fetch(`/api/clinic/workouts/${workoutId}`).then((res) => res.json());

    Promise.all([workoutFetch, fetch("/api/clinic/exercises").then((res) => res.json())])
      .then(([workoutData, libraryData]) => {
        if (cancelled) return;
        if (workoutData.error) throw new Error(workoutData.error);
        setData(workoutData);
        setExerciseLibrary(libraryData.exercises ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load this session.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId]);

  if (loading) return <div className={styles.notice}>Loading this session…</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!data) return null;

  return (
    <WorkoutBuilder
      key={workoutId}
      mode={mode}
      workoutId={data.id}
      initialName={data.name}
      initialHighLoad={data.high_load}
      initialItems={data.items}
      exerciseLibrary={exerciseLibrary}
      initialBlockDetails={data.blockDetails}
      initialCardioBlockDetails={data.cardioBlockDetails}
      defaultBlockLengthWeeks={defaultBlockLengthWeeks}
      onSaved={onSaved}
    />
  );
}
