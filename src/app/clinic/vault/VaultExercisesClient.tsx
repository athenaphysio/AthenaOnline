"use client";

import { useMemo, useState } from "react";
import { SLOT_TYPES, slotTypeLabel, type SlotType } from "@/lib/slotTypes";
import type { Equipment } from "@/lib/equipment";
import type { PrescriptionMode } from "@/lib/prescriptionMode";
import VaultBuilderPanel from "./VaultBuilderPanel";
import styles from "./VaultLibrary.module.css";
import { FavouriteStar, FavouritesToggle, useFavourites } from "../FavouritesContext";

export type BodyPart = { id: string; name: string; type: "joint" | "muscle" };

export type ExerciseCard = {
  id: string;
  name: string;
  category: SlotType | string | null;
  dosageText: string | null;
  defaultPrescriptionMode: PrescriptionMode;
  cuesNotes: string | null;
  vimeoUrl: string | null;
  thumbnailUrl: string | null;
  needsVideo: boolean;
  bodyPartIds: string[];
  bodyParts: BodyPart[];
  equipmentIds: string[];
  equipment: Equipment[];
};

type FilterKey = "all" | "needs_video" | SlotType;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  ...SLOT_TYPES.map((t) => ({ key: t.value as FilterKey, label: t.label })),
  { key: "needs_video", label: "Needs video" },
];

export default function VaultExercisesClient({
  exercises,
  nextExerciseId,
  allBodyParts,
  allEquipment,
}: {
  exercises: ExerciseCard[];
  nextExerciseId: string;
  allBodyParts: BodyPart[];
  allEquipment: Equipment[];
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [bodyPartFilter, setBodyPartFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [search, setSearch] = useState("");
  const favourites = useFavourites();
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = exercises.find((e) => e.id === selectedId) ?? null;
  const joints = allBodyParts.filter((bp) => bp.type === "joint");
  const muscles = allBodyParts.filter((bp) => bp.type === "muscle");

  const filtered = useMemo(() => {
    const matching = exercises.filter((e) => {
      if (favouritesOnly && !favourites.isFavourite("exercise", e.id)) return false;
      if (filter === "needs_video" && !e.needsVideo) return false;
      if (filter !== "all" && filter !== "needs_video" && e.category !== filter) return false;
      if (bodyPartFilter && !e.bodyPartIds.includes(bodyPartFilter)) return false;
      if (equipmentFilter && !e.equipmentIds.includes(equipmentFilter)) return false;
      if (search.trim() && !e.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
    return favourites.favouritesFirst(matching, (e) => ({ type: "exercise", id: e.id }));
  }, [exercises, filter, bodyPartFilter, equipmentFilter, search, favouritesOnly, favourites]);

  return (
    <div className={styles.layout}>
      <VaultBuilderPanel
        key={selected?.id ?? "new"}
        existing={selected}
        nextExerciseId={nextExerciseId}
        allBodyParts={allBodyParts}
        allEquipment={allEquipment}
        onDone={() => setSelectedId(null)}
      />

      <div className={`${styles.card} ${styles.library}`}>
        <div className={styles.libraryHead}>
          <h3>
            Exercise library <span className={styles.libraryCount}>({exercises.length})</span>
          </h3>
          <div className={styles.libraryHeadControls}>
            <select
              className={styles.bodyPartFilter}
              value={bodyPartFilter}
              onChange={(e) => setBodyPartFilter(e.target.value)}
            >
              <option value="">Filter by body part</option>
              <optgroup label="Joints">
                {joints.map((bp) => (
                  <option key={bp.id} value={bp.id}>
                    {bp.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Muscles">
                {muscles.map((bp) => (
                  <option key={bp.id} value={bp.id}>
                    {bp.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <select
              className={styles.bodyPartFilter}
              value={equipmentFilter}
              onChange={(e) => setEquipmentFilter(e.target.value)}
            >
              <option value="">Filter by equipment</option>
              {allEquipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name}
                </option>
              ))}
            </select>
            <input
              className={styles.search}
              type="text"
              placeholder="Search exercises…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <FavouritesToggle active={favouritesOnly} onChange={setFavouritesOnly} />
          </div>
        </div>

        <div className={styles.filterRow}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`${styles.chip} ${filter === f.key ? styles.chipActive : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            {favouritesOnly ? "No favourite exercises here yet. Tap the star next to any exercise you use often." : "Nothing matches."}
          </div>
        ) : (
          <div className={styles.exGrid}>
            {filtered.map((e) => (
              <div
                key={e.id}
                role="button"
                tabIndex={0}
                className={`${styles.exCard} ${e.id === selectedId ? styles.exCardActive : ""}`}
                onClick={() => setSelectedId(e.id === selectedId ? null : e.id)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") setSelectedId(e.id === selectedId ? null : e.id);
                }}
              >
                <div className={styles.exThumb}>
                  {e.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.thumbnailUrl} alt="" className={styles.exThumbImg} />
                  ) : (
                    <div className={styles.exThumbFallback}>{e.needsVideo ? "Needs video" : "No thumbnail"}</div>
                  )}
                  {e.category && <span className={styles.cat}>{slotTypeLabel(e.category)}</span>}
                </div>
                <div className={styles.exBody}>
                  <div className={styles.exName}>
                    <FavouriteStar type="exercise" id={e.id} size={18} style={{ marginLeft: -4, marginRight: 2 }} />
                    {e.name}
                  </div>
                  <div className={styles.exId}>{e.id}</div>
                  {e.bodyParts.length > 0 && (
                    <div className={styles.exTags}>
                      {e.bodyParts.map((bp) => (
                        <span
                          key={bp.id}
                          className={`${styles.bodyPartTag} ${bp.type === "joint" ? styles.bodyPartTagJoint : styles.bodyPartTagMuscle}`}
                        >
                          {bp.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {e.equipment.length > 0 && (
                    <div className={styles.exTags}>
                      {e.equipment.map((eq) => (
                        <span key={eq.id} className={styles.equipmentTag}>
                          {eq.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
