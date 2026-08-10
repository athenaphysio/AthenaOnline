"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";
import styles from "./EquipmentManager.module.css";

export type EquipmentRow = { id: string; name: string; icon_url: string | null };

function EquipmentRowItem({ item }: { item: EquipmentRow }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className={styles.name}>{item.name}</div>
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
        {error && <span className={styles.error}>{error}</span>}
      </div>
    </div>
  );
}

export default function EquipmentManagerClient({ equipment }: { equipment: EquipmentRow[] }) {
  if (equipment.length === 0) {
    return (
      <div className={clinicStyles.card}>
        <p className={clinicStyles.notice}>No equipment items yet.</p>
      </div>
    );
  }

  return (
    <div className={clinicStyles.card}>
      {equipment.map((item) => (
        <EquipmentRowItem key={item.id} item={item} />
      ))}
    </div>
  );
}
