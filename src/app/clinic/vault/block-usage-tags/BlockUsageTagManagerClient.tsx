"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";
import styles from "../equipment/EquipmentManager.module.css";

export type BlockUsageTagRow = { id: string; name: string; usageCount: number };

function BlockUsageTagRowItem({ item }: { item: BlockUsageTagRow }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveRename() {
    if (!nameDraft.trim() || nameDraft.trim() === item.name) {
      setRenaming(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/clinic/vault/block-usage-tags/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameDraft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Rename failed.");
      setRenaming(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed.");
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/vault/block-usage-tags/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  }

  return (
    <div className={styles.row}>
      {renaming ? (
        <input
          className={styles.nameInput}
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saveRename()}
          autoFocus
        />
      ) : (
        <div className={styles.name}>{item.name}</div>
      )}

      <div className={styles.usageCount}>
        {item.usageCount === 0 ? "Not used yet" : `Used on ${item.usageCount} block${item.usageCount === 1 ? "" : "s"}`}
      </div>

      <div className={styles.actions}>
        {renaming ? (
          <button type="button" className={clinicStyles.buttonSecondary} style={{ width: "auto", padding: "0 16px", height: 34 }} onClick={saveRename}>
            Save
          </button>
        ) : (
          <button
            type="button"
            className={clinicStyles.buttonSecondary}
            style={{ width: "auto", padding: "0 16px", height: 34 }}
            onClick={() => {
              setNameDraft(item.name);
              setRenaming(true);
            }}
          >
            Rename
          </button>
        )}

        <button
          type="button"
          className={clinicStyles.buttonSecondary}
          style={{ width: "auto", padding: "0 16px", height: 34 }}
          onClick={() => setConfirmingDelete(true)}
        >
          Remove
        </button>

        {error && <span className={styles.error}>{error}</span>}
      </div>

      {confirmingDelete && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            <p>
              {item.usageCount > 0
                ? `"${item.name}" is currently tagged on ${item.usageCount} block${item.usageCount === 1 ? "" : "s"}. Removing it will untag it from all of them. This can't be undone.`
                : `Remove "${item.name}"? It isn't tagged on any blocks, so this is safe.`}
            </p>
            <div className={styles.confirmActions}>
              <button type="button" className={clinicStyles.buttonSecondary} onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
              <button type="button" className={clinicStyles.button} onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Removing…" : "Remove it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddBlockUsageTagForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic/vault/block-usage-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed.");
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.addForm}>
      <input
        className={styles.nameInput}
        placeholder="New usage tag"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ flex: 1 }}
      />
      <button type="button" className={clinicStyles.button} style={{ width: "auto", padding: "0 20px" }} onClick={save} disabled={saving}>
        {saving ? "Adding…" : "Add tag"}
      </button>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

export default function BlockUsageTagManagerClient({ tags }: { tags: BlockUsageTagRow[] }) {
  return (
    <div>
      <AddBlockUsageTagForm />
      {tags.map((item) => (
        <BlockUsageTagRowItem key={item.id} item={item} />
      ))}
    </div>
  );
}
