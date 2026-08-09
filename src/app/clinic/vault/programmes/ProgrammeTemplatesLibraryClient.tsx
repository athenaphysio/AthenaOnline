"use client";

import { useMemo, useState } from "react";
import styles from "./VaultProgrammes.module.css";

export type ProgrammeTemplatePhase = { name: string; startWeek: number; endWeek: number };
export type ProgrammeTemplateCard = {
  id: string;
  name: string;
  weeks: number;
  tags: string[];
  phases: ProgrammeTemplatePhase[];
};

export default function ProgrammeTemplatesLibraryClient({ templates }: { templates: ProgrammeTemplateCard[] }) {
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const allTags = useMemo(() => {
    const seen = new Set<string>();
    for (const t of templates) for (const tag of t.tags) seen.add(tag);
    return Array.from(seen).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (tagFilter && !t.tags.includes(tagFilter)) return false;
      if (search.trim() && !t.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [templates, search, tagFilter]);

  return (
    <div className={`${styles.card} ${styles.library}`}>
      <div className={styles.libraryHead}>
        <h3>
          Programme template library <span className={styles.libraryCount}>({templates.length})</span>
        </h3>
        <input
          className={styles.search}
          type="text"
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {allTags.length > 0 && (
        <div className={styles.filterRow}>
          <button
            type="button"
            className={`${styles.chip} ${tagFilter === "" ? styles.chipActive : ""}`}
            onClick={() => setTagFilter("")}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`${styles.chip} ${tagFilter === tag ? styles.chipActive : ""}`}
              onClick={() => setTagFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {templates.length === 0 ? (
        <div className={styles.emptyState}>No programme templates yet.</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>Nothing matches.</div>
      ) : (
        <div className={styles.templateGrid}>
          {filtered.map((t) => (
            <div key={t.id} className={styles.templateCard}>
              <div className={styles.templateName}>{t.name}</div>
              <div className={styles.templateMeta}>
                {t.weeks} week{t.weeks === 1 ? "" : "s"}
              </div>
              {t.phases.length > 0 && (
                <div className={styles.phaseList}>
                  {t.phases.map((p) => (
                    <span key={p.name} className={styles.phaseTag}>
                      {p.name} (wk {p.startWeek}-{p.endWeek})
                    </span>
                  ))}
                </div>
              )}
              {t.tags.length > 0 && (
                <div className={styles.tagList}>
                  {t.tags.map((tag) => (
                    <span key={tag} className={styles.templateTag}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
