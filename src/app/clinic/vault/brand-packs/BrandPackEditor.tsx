"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";
import confirmStyles from "../equipment/EquipmentManager.module.css";
import styles from "./BrandPacks.module.css";
import { useUnsavedChanges } from "../../useUnsavedChanges";
import { BRAND_PACK_COMPONENTS, type BrandPackComponentKey } from "@/lib/brandPackSpec";
import BrandPackComponentUploader from "./BrandPackComponentUploader";
import type { BrandPack, BrandPackUsage } from "@/lib/brandPack";

type Props = {
  mode: "create" | "edit";
  packId: string;
  isDefault: boolean;
  initial: Pick<
    BrandPack,
    | "name"
    | "accent_color"
    | "background_color"
    | "logo_mark_url"
    | "wordmark_url"
    | "cover_square_url"
    | "wide_banner_url"
    | "small_square_url"
    | "background_texture_url"
  >;
  usage: BrandPackUsage | null;
};

type ImageUrls = Record<BrandPackComponentKey, string | null>;

function urlsFromPack(initial: Props["initial"]): ImageUrls {
  return {
    logo_mark: initial.logo_mark_url,
    wordmark: initial.wordmark_url,
    cover_square: initial.cover_square_url,
    wide_banner: initial.wide_banner_url,
    small_square: initial.small_square_url,
    background_texture: initial.background_texture_url,
  };
}

export default function BrandPackEditor({ mode, packId, isDefault, initial, usage }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [accentColor, setAccentColor] = useState(initial.accent_color);
  const [backgroundColor, setBackgroundColor] = useState(initial.background_color);
  const [imageUrls, setImageUrls] = useState<ImageUrls>(urlsFromPack(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { markSaved } = useUnsavedChanges({ name, accentColor, backgroundColor, imageUrls });

  // Ref, not plain state -- survives across renders so an upload firing
  // before the first Save click, then Save clicked later, never double-
  // creates the row. Same pattern as the Friends admin form.
  const createdRef = useRef(mode === "edit");
  async function ensureCreated() {
    if (createdRef.current) return;
    const res = await fetch("/api/clinic/brand-packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: packId,
        name: name.trim() || "Untitled pack",
        accent_color: accentColor,
        background_color: backgroundColor,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn't start this pack.");
    createdRef.current = true;
  }

  async function handleUpload(component: BrandPackComponentKey, file: File): Promise<{ url: string; warning: string | null }> {
    await ensureCreated();
    const formData = new FormData();
    formData.append("component", component);
    formData.append("image", file);
    const res = await fetch(`/api/clinic/brand-packs/${packId}/image`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed.");
    setImageUrls((prev) => ({ ...prev, [component]: data.url }));
    return { url: data.url, warning: data.warning ?? null };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await ensureCreated();
      const res = await fetch(`/api/clinic/brand-packs/${packId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          accent_color: accentColor,
          background_color: backgroundColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setSaved(true);
      markSaved({ name, accentColor, backgroundColor, imageUrls });
      if (mode === "create") router.push(`/clinic/vault/brand-packs/${packId}`);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/clinic/brand-packs/${packId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      router.push("/clinic/vault/brand-packs");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  }

  const hasUsage = usage && (usage.programmeNames.length > 0 || usage.patientNames.length > 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
      <div className={clinicStyles.card}>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Pack name</label>
          <input
            className={clinicStyles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isDefault}
            placeholder="e.g. Atomic Basketball"
          />
          {isDefault && (
            <p className={clinicStyles.notice} style={{ marginTop: 6 }}>
              This is the permanent fallback pack -- it can&apos;t be renamed or deleted, but its colours and
              images can still be updated.
            </p>
          )}
        </div>

        <div className={styles.colorRow}>
          <div className={styles.colorField}>
            <label className={clinicStyles.label}>Accent colour</label>
            <div className={styles.colorPickRow}>
              <input
                type="color"
                className={styles.colorSwatch}
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
              />
              <input
                className={styles.colorHexInput}
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#B83A60"
              />
            </div>
          </div>
          <div className={styles.colorField}>
            <label className={clinicStyles.label}>Background colour</label>
            <div className={styles.colorPickRow}>
              <input
                type="color"
                className={styles.colorSwatch}
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
              />
              <input
                className={styles.colorHexInput}
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                placeholder="#EFEAE6"
              />
            </div>
          </div>
        </div>

        <div className={styles.uploadGrid}>
          {BRAND_PACK_COMPONENTS.map((spec) => (
            <BrandPackComponentUploader
              key={spec.key}
              spec={spec}
              existingUrl={imageUrls[spec.key]}
              onUpload={(file) => handleUpload(spec.key, file)}
            />
          ))}
        </div>

        {error && (
          <div className={clinicStyles.error} style={{ marginTop: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 20 }}>
          <button
            type="button"
            className={clinicStyles.button}
            style={{ width: "auto", padding: "0 28px" }}
            disabled={saving || !name.trim() || !accentColor.trim() || !backgroundColor.trim()}
            onClick={handleSave}
          >
            {saving ? "Saving…" : saved ? "Save changes" : "Save pack"}
          </button>
          {mode === "edit" && !isDefault && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              style={{ background: "none", border: "none", padding: 0, font: "inherit", fontSize: 13.5, color: "var(--muted)", cursor: "pointer" }}
            >
              Delete this pack
            </button>
          )}
        </div>

        {confirmingDelete && (
          <div className={confirmStyles.confirmOverlay}>
            <div className={confirmStyles.confirmBox}>
              {hasUsage ? (
                <>
                  <p>
                    &ldquo;{name}&rdquo; is currently assigned to:
                  </p>
                  <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                    {usage!.programmeNames.map((n, i) => (
                      <li key={`p-${i}`}>Programme: {n}</li>
                    ))}
                    {usage!.patientNames.map((n, i) => (
                      <li key={`c-${i}`}>Client: {n}</li>
                    ))}
                  </ul>
                  <p>Deleting it will clear those assignments -- they&apos;ll fall back to the default pack. This can&apos;t be undone.</p>
                </>
              ) : (
                <p>Delete &ldquo;{name}&rdquo;? This can&apos;t be undone.</p>
              )}
              {deleteError && <p style={{ color: "var(--crimson)", fontSize: 12.5 }}>{deleteError}</p>}
              <div className={confirmStyles.confirmActions}>
                <button type="button" className={clinicStyles.buttonSecondary} onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </button>
                <button type="button" className={clinicStyles.button} onClick={confirmDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete it"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.previewPanel}>
        <div className={clinicStyles.label} style={{ marginBottom: 10 }}>
          Live preview
        </div>
        <div className={styles.previewCoverWrap}>
          {imageUrls.cover_square ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrls.cover_square} alt="" className={styles.previewCoverImg} />
          ) : (
            <div className={styles.previewCoverPlaceholder} style={{ background: backgroundColor }}>
              No cover yet
            </div>
          )}
        </div>

        <div className={styles.mockCard}>
          <div className={styles.mockCardTop} style={{ background: accentColor }}>
            <span className={styles.mockCardTopText}>{name || "Pack name"}</span>
          </div>
          <div className={styles.mockCardBody} style={{ background: backgroundColor }}>
            <div className={styles.mockCardBodyTitle}>Sample programme card</div>
            <div className={styles.mockCardBodyBar} style={{ background: accentColor, opacity: 0.35 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
