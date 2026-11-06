"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { FavouriteType } from "@/lib/favouriteTypes";

// Dr David Silver PhD's starred exercises, blocks, workouts and programmes,
// loaded once for the whole clinic so every library list and builder
// picker can show the star, put favourites first, and offer a Favourites
// only view. Starring updates on screen straight away and saves in the
// background; if the save fails, the star goes back to how it was.

type FavouritesValue = {
  isFavourite: (type: FavouriteType, id: string) => boolean;
  toggle: (type: FavouriteType, id: string) => void;
  /** Same items, favourites first, otherwise in their existing order. */
  favouritesFirst: <T>(items: T[], ref: (item: T) => FavouriteRef) => T[];
};

/** Which favourite an item is: its kind of library item and its id. */
export type FavouriteRef = { type: FavouriteType; id: string };

const keyOf = (type: FavouriteType, id: string) => `${type}:${id}`;

const FavouritesContext = createContext<FavouritesValue>({
  isFavourite: () => false,
  toggle: () => {},
  favouritesFirst: (items) => items,
});

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/clinic/favourites")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { favourites?: { item_type: FavouriteType; item_id: string }[] } | null) => {
        if (cancelled || !data?.favourites) return;
        setKeys(new Set(data.favourites.map((f) => keyOf(f.item_type, f.item_id))));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const isFavourite = useCallback((type: FavouriteType, id: string) => keys.has(keyOf(type, id)), [keys]);

  const toggle = useCallback(
    (type: FavouriteType, id: string) => {
      const key = keyOf(type, id);
      const favourite = !keys.has(key);
      const flip = (on: boolean) =>
        setKeys((prev) => {
          const next = new Set(prev);
          if (on) next.add(key);
          else next.delete(key);
          return next;
        });
      flip(favourite);
      fetch("/api/clinic/favourites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: type, item_id: id, favourite }),
      })
        .then((r) => {
          if (!r.ok) flip(!favourite);
        })
        .catch(() => flip(!favourite));
    },
    [keys]
  );

  const favouritesFirst = useCallback(
    <T,>(items: T[], ref: (item: T) => FavouriteRef): T[] => {
      if (keys.size === 0) return items;
      const favs: T[] = [];
      const rest: T[] = [];
      for (const item of items) {
        const r = ref(item);
        (keys.has(keyOf(r.type, r.id)) ? favs : rest).push(item);
      }
      return favs.length === 0 ? items : [...favs, ...rest];
    },
    [keys]
  );

  const value = useMemo(() => ({ isFavourite, toggle, favouritesFirst }), [isFavourite, toggle, favouritesFirst]);
  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

export function useFavourites() {
  return useContext(FavouritesContext);
}

const GOLD = "#d4a017";

/** The star itself. Clicking it never triggers the row it sits in. */
export function FavouriteStar({
  type,
  id,
  size = 20,
  style,
}: {
  type: FavouriteType;
  id: string;
  size?: number;
  style?: CSSProperties;
}) {
  const { isFavourite, toggle } = useFavourites();
  const on = isFavourite(type, id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle(type, id);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      draggable={false}
      aria-pressed={on}
      aria-label={on ? "Remove from favourites" : "Add to favourites"}
      title={on ? "Remove from favourites" : "Add to favourites"}
      style={{
        background: "none",
        border: "none",
        padding: 4,
        margin: 0,
        cursor: "pointer",
        fontSize: size,
        lineHeight: 1,
        color: on ? GOLD : "currentColor",
        opacity: on ? 1 : 0.45,
        flex: "0 0 auto",
        width: "auto",
        height: "auto",
        verticalAlign: "middle",
        ...style,
      }}
    >
      {on ? "★" : "☆"}
    </button>
  );
}

/** A "Favourites" on/off button to sit beside a list's search box. */
export function FavouritesToggle({
  active,
  onChange,
  compact = false,
}: {
  active: boolean;
  onChange: (active: boolean) => void;
  /** Smaller, to sit in a row of filter chips. */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      aria-pressed={active}
      title={active ? "Show everything" : "Show only your favourites"}
      style={{
        flex: "0 0 auto",
        width: "auto",
        whiteSpace: "nowrap",
        height: compact ? 32 : 40,
        padding: compact ? "0 12px" : "0 14px",
        borderRadius: 999,
        border: `1.5px solid ${active ? GOLD : "rgba(128,128,128,0.45)"}`,
        background: active ? "rgba(212,160,23,0.16)" : "transparent",
        color: "inherit",
        font: "inherit",
        fontSize: 13.5,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      <span style={{ color: GOLD, marginRight: 6 }}>{active ? "★" : "☆"}</span>
      Favourites
    </button>
  );
}
