"use client";

import { useState } from "react";
import Link from "next/link";
import listStyles from "./CardioProgrammes.module.css";
import { FavouriteStar, FavouritesToggle, useFavourites } from "../../FavouritesContext";

export type CardioProgrammeRow = {
  id: string;
  name: string;
  goal: string | null;
  suggested_phase: string | null;
  total_weeks: number | null;
  review_status: "pending" | "reviewed";
};

// The cardio programmes list, with starred programmes first and a
// Favourites button to show only them.
export default function CardioProgrammesList({ programmes }: { programmes: CardioProgrammeRow[] }) {
  const favourites = useFavourites();
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const shown = favourites.favouritesFirst(
    favouritesOnly ? programmes.filter((p) => favourites.isFavourite("cardio_programme", p.id)) : programmes,
    (p) => ({ type: "cardio_programme", id: p.id })
  );

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <FavouritesToggle active={favouritesOnly} onChange={setFavouritesOnly} />
      </div>
      {favouritesOnly && shown.length === 0 && (
        <p style={{ opacity: 0.75 }}>No favourite cardio programmes yet. Tap the star next to any programme you use often.</p>
      )}
      <div className={listStyles.list}>
        {shown.map((p) => (
          <Link key={p.id} href={`/clinic/vault/cardio-programmes/${p.id}`} className={listStyles.row}>
            <div className={listStyles.rowMain}>
              <div className={listStyles.rowName}>
                <FavouriteStar type="cardio_programme" id={p.id} size={18} style={{ marginLeft: -4, marginRight: 2 }} />
                {p.name}
              </div>
              {p.goal && <div className={listStyles.rowGoal}>{p.goal}</div>}
            </div>
            <div className={listStyles.rowMeta}>
              {p.suggested_phase && <span className={listStyles.phaseTag}>{p.suggested_phase}</span>}
              {p.total_weeks && <span className={listStyles.weeksTag}>{p.total_weeks} weeks</span>}
              <span className={p.review_status === "pending" ? listStyles.pendingTag : listStyles.reviewedTag}>
                {p.review_status === "pending" ? "Pending review" : "Reviewed"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
