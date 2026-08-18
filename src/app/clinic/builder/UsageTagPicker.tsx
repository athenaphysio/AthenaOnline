"use client";

import { useState } from "react";
import type { BlockUsageTag } from "@/lib/blockUsageTags";
import styles from "./UsageTagPicker.module.css";

type Props = {
  catalog: BlockUsageTag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onTagCreated: (tag: BlockUsageTag) => void;
};

// A second, finer classification on top of the block's Type dropdown --
// Running, Hip Hinge, Lumbar Stenosis, one flat growable list, multi-select
// since a block is often more than one of them. Toggling chips for the
// existing catalog, same interaction as DesignationPicker, plus an inline
// add box so a tag David thinks of mid-build doesn't send him away to a
// separate settings page first.
export default function UsageTagPicker({ catalog, selectedIds, onChange, onTagCreated }: Props) {
  const [newTagName, setNewTagName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((existingId) => existingId !== id) : [...selectedIds, id]);
  }

  async function addNewTag() {
    const name = newTagName.trim();
    if (!name) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic/vault/block-usage-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't add tag.");
      const tag: BlockUsageTag = { id: data.id, name: data.name };
      onTagCreated(tag);
      if (!selectedIds.includes(tag.id)) onChange([...selectedIds, tag.id]);
      setNewTagName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add tag.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      {catalog.length > 0 && (
        <div className={styles.chips}>
          {catalog.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={selectedIds.includes(t.id)}
              className={`${styles.chip} ${selectedIds.includes(t.id) ? styles.chipActive : ""}`}
              onClick={() => toggle(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <div className={styles.addRow}>
        <input
          className={styles.addInput}
          placeholder="Add a new usage tag…"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addNewTag();
            }
          }}
        />
        <button type="button" className={styles.addButton} disabled={adding || !newTagName.trim()} onClick={addNewTag}>
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
