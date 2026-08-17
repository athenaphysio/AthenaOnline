"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { PaletteKey } from "@/lib/builderPalette";

type BuilderPaletteValue = {
  /** True only while a builder that can accept content is mounted. The
   * far-left rail checks this to decide whether it is a palette or plain
   * navigation -- everywhere else it keeps behaving exactly as before. */
  active: boolean;
  /** Which content types the builder in front of you can actually take.
   * The rail offers only these, so nothing on it is ever a dead end: a
   * weekly calendar takes workouts, a workout takes blocks and exercises
   * and cardio. */
  supported: PaletteKey[];
  selected: PaletteKey;
  /** Narrows the block list further than the rail's own categories can --
   * the library's type dropdown offers every slot type, including ones
   * (main body, warm-up, cool-down) the rail has no row for. Empty means
   * no extra filter. Held here rather than in the builder so selecting a
   * category and narrowing it are one piece of state, not two that can
   * overwrite each other. */
  blockType: string;
  /** Switching category clears any narrower filter, so clicking Blocks
   * always means "all blocks" rather than silently keeping a stale one. */
  select: (key: PaletteKey) => void;
  setBlockType: (blockType: string) => void;
  /** Called by the builder on mount/unmount, with the keys it can take.
   * Pass an empty list to stand down. Always pass a stable array (a module
   * constant), since this runs from an effect. */
  setSupported: (keys: PaletteKey[]) => void;
};

const BuilderPaletteContext = createContext<BuilderPaletteValue | null>(null);

// Lives above both the sidebar and the page content (see ClinicShell), so
// clicking a content type in the rail is a state change in this provider
// rather than a route change. That is the whole point: the centre pane
// never unmounts, so nothing added and nothing half-edited is lost.
export function BuilderPaletteProvider({ children }: { children: ReactNode }) {
  const [supported, setSupportedState] = useState<PaletteKey[]>([]);
  const [selected, setSelected] = useState<PaletteKey>("blocks");
  const [blockType, setBlockType] = useState("");

  const select = useCallback((key: PaletteKey) => {
    setSelected(key);
    setBlockType("");
  }, []);

  // Registering a new set of supported types also lands the selection
  // somewhere valid, so moving from the calendar (workouts) into a day's
  // workout (blocks, exercises, cardio) never leaves the rail pointing at
  // something that builder cannot take.
  const setSupported = useCallback((keys: PaletteKey[]) => {
    setSupportedState(keys);
    setSelected((prev) => (keys.length === 0 || keys.includes(prev) ? prev : keys[0]));
    setBlockType("");
  }, []);

  const value = useMemo(
    () => ({ active: supported.length > 0, supported, selected, blockType, select, setBlockType, setSupported }),
    [supported, selected, blockType, select, setSupported]
  );

  return <BuilderPaletteContext.Provider value={value}>{children}</BuilderPaletteContext.Provider>;
}

export function useBuilderPalette(): BuilderPaletteValue {
  const ctx = useContext(BuilderPaletteContext);
  if (!ctx) {
    throw new Error("useBuilderPalette must be used inside BuilderPaletteProvider");
  }
  return ctx;
}
