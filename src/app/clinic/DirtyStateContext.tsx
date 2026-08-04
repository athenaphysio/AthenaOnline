"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type DirtyContextValue = {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
};

const DirtyContext = createContext<DirtyContextValue | null>(null);

// Wraps every /clinic page (see layout.tsx) so a single "is there unsaved
// work on the page right now" flag is available to the Home control,
// regardless of which builder happens to be mounted. Only one clinic page
// is ever visible at a time, so a single flag -- not a per-component
// registry -- is all that's needed.
export function DirtyStateProvider({ children }: { children: ReactNode }) {
  const [isDirty, setDirty] = useState(false);
  return <DirtyContext.Provider value={{ isDirty, setDirty }}>{children}</DirtyContext.Provider>;
}

// A few builders (e.g. ProgrammeTemplateBuilder) are shared with /coach/*,
// which sits outside this provider entirely -- degrade to a harmless no-op
// there rather than throwing, so the same component can be mounted in
// either tree. useUnsavedChanges' own beforeunload protection still works
// regardless, since that part doesn't depend on this context.
const NOOP_CONTEXT: DirtyContextValue = { isDirty: false, setDirty: () => {} };

export function useDirtyState(): DirtyContextValue {
  const ctx = useContext(DirtyContext);
  return ctx ?? NOOP_CONTEXT;
}
