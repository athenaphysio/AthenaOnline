"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";
import styles from "./EquipmentManager.module.css";

export type EquipmentRow = { id: string; name: string; icon_url: string | null; usageCount: number };

function EquipmentRowItem({ item }: { item: EquipmentRow }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`/api/clinic/vault/equipment/${item.id}/icon`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function saveRename() {
    if (!nameDraft.trim() || nameDraft.trim() === item.name) {
      setRenaming(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/clinic/vault/equipment/${item.id}`, {
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
      const res = await fetch(`/api/clinic/vault/equipment/${item.id}`, { method: "DELETE" });
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
      <div className={styles.iconSlot}>
        {item.icon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.icon_url} alt="" className={styles.iconImg} />
        ) : (
          <div className={styles.iconPlaceholder}>{item.name.charAt(0).toUpperCase()}</div>
        )}
      </div>

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
        {item.usageCount === 0 ? "Not used yet" : `Used on ${item.usageCount} exercise${item.usageCount === 1 ? "" : "s"}`}
      </div>

      <div className={styles.actions}>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          className={clinicStyles.buttonSecondary}
          style={{ width: "auto", padding: "0 16px", height: 34 }}
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? "Uploading…" : item.icon_url ? "Replace icon" : "Upload icon"}
        </button>

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
                ? `"${item.name}" is currently tagged on ${item.usageCount} exercise${item.usageCount === 1 ? "" : "s"}. Removing it will untag it from all of them. This can't be undone.`
                : `Remove "${item.name}"? It isn't tagged on any exercises, so this is safe.`}
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

function AddEquipmentForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function save() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      if (file) formData.append("image", file);
      const res = await fetch("/api/clinic/vault/equipment", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed.");
      setName("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
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
        placeholder="New equipment name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ flex: 1 }}
      />
      <input ref={fileInput} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button type="button" className={clinicStyles.button} style={{ width: "auto", padding: "0 20px" }} onClick={save} disabled={saving}>
        {saving ? "Adding…" : "Add equipment"}
      </button>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

export default function EquipmentManagerClient({ equipment }: { equipment: EquipmentRow[] }) {
  return (
    <>
      <div className={clinicStyles.card}>
        <div className={clinicStyles.cardTitle}>Add new equipment</div>
        <p style={{ fontSize: 12.5, color: "var(--graphite)", marginBottom: 10 }}>
          Icon is optional here -- upload an already-cut-out photo (background removed) and it's automatically
          recoloured into the crimson icon style and framed; add one later from the list below if you don&apos;t
          have one ready yet.
        </p>
        <AddEquipmentForm />
      </div>

      <div className={clinicStyles.card} style={{ marginTop: 16 }}>
        {equipment.length === 0 ? (
          <p className={clinicStyles.notice}>No equipment items yet.</p>
        ) : (
          equipment.map((item) => <EquipmentRowItem key={item.id} item={item} />)
        )}
      </div>
    </>
  );
}
