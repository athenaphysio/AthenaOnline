"use client";

import { useMemo, useState } from "react";
import { formatDurationMinutes } from "@/lib/vaultBlocksLibrary";
import type { Equipment } from "@/lib/equipment";
import EquipmentIconStrip from "./EquipmentIconStrip";
import styles from "./VaultSessions.module.css";
import { FavouriteStar, FavouritesToggle, useFavourites } from "../../FavouritesContext";

export type SessionItemSummary = { key: string; name: string; kind: "block" | "cardio" | "exercise" };
export type SessionCard = {
  id: string;
  name: string;
  highLoad: boolean;
  items: SessionItemSummary[];
  durationSeconds: number | null;
  equipmentIds: string[];
};

export default function SessionsLibraryClient({
  sessions,
  equipment,
  selectedId,
  onSelect,
}: {
  sessions: SessionCard[];
  equipment: Equipment[];
  selectedId?: string | null;
  onSelect?: (session: SessionCard) => void;
}) {
  const [search, setSearch] = useState("");
  const favourites = useFavourites();
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matching = sessions.filter(
      (s) => (!q || s.name.toLowerCase().includes(q)) && (!favouritesOnly || favourites.isFavourite("workout", s.id))
    );
    return favourites.favouritesFirst(matching, (s) => ({ type: "workout", id: s.id }));
  }, [sessions, search, favouritesOnly, favourites]);

  return (
    <div className={`${styles.card} ${styles.library}`}>
      <div className={styles.libraryHead}>
        <h3>
          Workout library <span className={styles.libraryCount}>({sessions.length})</span>
        </h3>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className={styles.search}
            type="text"
            placeholder="Search workouts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <FavouritesToggle active={favouritesOnly} onChange={setFavouritesOnly} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          {favouritesOnly ? "No favourite workouts here yet. Tap the star next to any workout you use often." : "Nothing matches."}
        </div>
      ) : (
        <div className={styles.sessionGrid}>
          {filtered.map((s) => {
            const duration = formatDurationMinutes(s.durationSeconds);
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect?.(s)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect?.(s);
                }}
                className={`${styles.sessionCard} ${s.id === selectedId ? styles.sessionCardActive : ""}`}
              >
                <div className={styles.sessionCardHead}>
                  <span className={styles.sessionName}>
                    <FavouriteStar type="workout" id={s.id} size={18} style={{ marginLeft: -4, marginRight: 2 }} />
                    {s.name}
                    {s.highLoad && <span className={styles.highLoadTag}>High load</span>}
                  </span>
                  {duration && <span className={styles.durationTag}>~{duration}</span>}
                </div>
                <EquipmentIconStrip equipmentIds={s.equipmentIds} equipment={equipment} compact />
                {s.items.length === 0 ? (
                  <div className={styles.emptyState} style={{ padding: 0, textAlign: "left" }}>
                    No blocks added yet.
                  </div>
                ) : (
                  <div className={styles.sessionItems}>
                    {s.items.map((item) => (
                      <span
                        key={item.key}
                        className={`${styles.sessionItemTag} ${
                          item.kind === "block" ? styles.sessionItemTagBlock : item.kind === "cardio" ? styles.sessionItemTagCardio : ""
                        }`}
                      >
                        {item.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
