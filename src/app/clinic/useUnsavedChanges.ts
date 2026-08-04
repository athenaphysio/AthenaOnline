"use client";

import { useEffect, useRef } from "react";
import { useDirtyState } from "./DirtyStateContext";

// Tracks whether `value` has drifted from the last point it was considered
// "saved" -- either when this hook first mounted, or whenever markSaved() is
// called after a successful save -- and registers that with the shared
// clinic-wide dirty flag the Home control checks before navigating away.
//
// `value` should be just the fields that represent real edits (title,
// question list, selected exercises...), not transient UI state like a
// search query or which accordion is open -- those would make the page
// register as "dirty" from a click that changed nothing worth protecting.
export function useUnsavedChanges<T>(value: T) {
  const savedRef = useRef(JSON.stringify(value));
  const hasChanges = JSON.stringify(value) !== savedRef.current;
  const { setDirty } = useDirtyState();

  useEffect(() => {
    setDirty(hasChanges);
  }, [hasChanges, setDirty]);

  // Leaving this page (successfully, having navigated past the guard) means
  // whatever was unsaved here is no longer this page's problem -- clear the
  // flag so it can't block navigation from some other, clean page later.
  useEffect(() => {
    return () => setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasChanges) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  function markSaved(nextValue?: T) {
    savedRef.current = JSON.stringify(nextValue ?? value);
  }

  return { hasChanges, markSaved };
}
