"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SLOT_TYPES } from "@/lib/slotTypes";
import type { Equipment } from "@/lib/equipment";
import type { BodyPart, ExerciseCard } from "./VaultExercisesClient";
import styles from "./VaultLibrary.module.css";

type CheckState = "idle" | "checking" | "found" | "not_found";

export default function VaultBuilderPanel({
  existing,
  nextExerciseId,
  allBodyParts,
  allEquipment,
  onDone,
}: {
  existing: ExerciseCard | null;
  nextExerciseId: string;
  allBodyParts: BodyPart[];
  allEquipment: Equipment[];
  onDone: () => void;
}) {
  const router = useRouter();

  const [vimeoLink, setVimeoLink] = useState(existing?.vimeoUrl ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [dosageText, setDosageText] = useState(existing?.dosageText ?? "");
  const [cuesNotes, setCuesNotes] = useState(existing?.cuesNotes ?? "");
  const [bodyPartIds, setBodyPartIds] = useState<string[]>(existing?.bodyPartIds ?? []);
  const [equipmentIds, setEquipmentIds] = useState<string[]>(existing?.equipmentIds ?? []);

  const bodyPartsById = new Map(allBodyParts.map((bp) => [bp.id, bp]));
  const joints = allBodyParts.filter((bp) => bp.type === "joint" && !bodyPartIds.includes(bp.id));
  const muscles = allBodyParts.filter((bp) => bp.type === "muscle" && !bodyPartIds.includes(bp.id));

  const equipmentById = new Map(allEquipment.map((eq) => [eq.id, eq]));
  const availableEquipment = allEquipment.filter((eq) => !equipmentIds.includes(eq.id));

  function addBodyPart(id: string) {
    if (!id || bodyPartIds.includes(id)) return;
    setBodyPartIds([...bodyPartIds, id]);
  }

  function removeBodyPart(id: string) {
    setBodyPartIds(bodyPartIds.filter((existingId) => existingId !== id));
  }

  function addEquipment(id: string) {
    if (!id || equipmentIds.includes(id)) return;
    setEquipmentIds([...equipmentIds, id]);
  }

  function removeEquipment(id: string) {
    setEquipmentIds(equipmentIds.filter((existingId) => existingId !== id));
  }

  const [checkState, setCheckState] = useState<CheckState>(existing?.vimeoUrl ? "found" : "idle");
  const [previewThumbnail, setPreviewThumbnail] = useState<string | null>(existing?.thumbnailUrl ?? null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const lastCheckedLink = useRef(existing?.vimeoUrl ?? "");

  async function checkVimeoLink() {
    const link = vimeoLink.trim();
    if (!link) {
      setCheckState("idle");
      setPreviewThumbnail(null);
      return;
    }
    if (link === lastCheckedLink.current && checkState !== "idle") return;

    setCheckState("checking");
    try {
      const res = await fetch(`/api/clinic/vault/vimeo-preview?url=${encodeURIComponent(link)}`);
      const data = await res.json();
      lastCheckedLink.current = link;
      if (data.found) {
        setCheckState("found");
        setPreviewThumbnail(data.thumbnailUrl ?? null);
      } else {
        setCheckState("not_found");
        setPreviewThumbnail(null);
      }
    } catch {
      setCheckState("not_found");
      setPreviewThumbnail(null);
    }
  }

  function handleCoverFile(file: File | null) {
    setCoverFile(file);
    if (file) setPreviewThumbnail(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!name.trim()) {
      setSaveError("Exercise name is required.");
      return;
    }
    setSaving(true);
    setSaveError(null);

    try {
      const payload = {
        name_clinical: name,
        default_category: category || null,
        default_dosage_text: dosageText || null,
        cues_notes: cuesNotes || null,
        vimeo_url: vimeoLink.trim() || null,
        body_part_ids: bodyPartIds,
        equipment_ids: equipmentIds,
      };

      const res = existing
        ? await fetch(`/api/clinic/vault/exercises/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/clinic/vault/exercises", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");

      const savedId: string = data.exercise_id;

      if (coverFile) {
        const formData = new FormData();
        formData.append("image", coverFile);
        const coverRes = await fetch(`/api/clinic/vault/exercises/${savedId}/cover-image`, {
          method: "POST",
          body: formData,
        });
        if (!coverRes.ok) {
          const coverData = await coverRes.json();
          throw new Error(coverData.error ?? "Cover upload failed.");
        }
      }

      router.refresh();
      onDone();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${styles.card} ${styles.builder}`}>
      <h3>{existing ? `Editing ${existing.id}` : "New exercise"}</h3>

      <div className={styles.field}>
        <label>Vimeo link</label>
        <input
          type="text"
          value={vimeoLink}
          placeholder="Paste a Vimeo URL…"
          onChange={(e) => {
            setVimeoLink(e.target.value);
            setCheckState("idle");
          }}
          onBlur={checkVimeoLink}
        />
        {checkState === "checking" && <div className={styles.vimeoStatus}>Checking…</div>}
        {checkState === "found" && (
          <div className={styles.vimeoStatus}>
            <span className={styles.dotOk} />
            Video found, cover pulled automatically
          </div>
        )}
        {checkState === "not_found" && (
          <div className={styles.vimeoStatusWarn}>Couldn't find that video. Upload a cover below instead.</div>
        )}

        {(previewThumbnail || checkState === "not_found") && (
          <div className={styles.thumbPreview}>
            {previewThumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewThumbnail} alt="" />
            ) : (
              <div className={styles.thumbFallback}>
                <span>Thumbnail preview</span>
              </div>
            )}
          </div>
        )}

        {(checkState === "not_found" || (existing?.needsVideo && !vimeoLink)) && (
          <div className={styles.uploadAlt}>
            <label className={styles.uploadLink}>
              Upload your own cover ↗
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleCoverFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {coverFile && <span> {coverFile.name}</span>}
          </div>
        )}
      </div>

      <div className={styles.field}>
        <label>Exercise name</label>
        <input
          type="text"
          value={name}
          placeholder="e.g. Single-leg balance reach"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className={styles.row2}>
        <div className={styles.field}>
          <label>Category / slot type</label>
          <select value={category ?? ""} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Not set</option>
            {SLOT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label>Default prescription</label>
          <input
            type="text"
            value={dosageText}
            placeholder="e.g. 3 × 10 each side"
            onChange={(e) => setDosageText(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label>Coaching cues</label>
        <textarea
          value={cuesNotes}
          placeholder="Notes shown to the patient, form cues, things to watch for…"
          onChange={(e) => setCuesNotes(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label>Body parts</label>
        <select value="" onChange={(e) => addBodyPart(e.target.value)}>
          <option value="">Add a joint or muscle…</option>
          {joints.length > 0 && (
            <optgroup label="Joints">
              {joints.map((bp) => (
                <option key={bp.id} value={bp.id}>
                  {bp.name}
                </option>
              ))}
            </optgroup>
          )}
          {muscles.length > 0 && (
            <optgroup label="Muscles">
              {muscles.map((bp) => (
                <option key={bp.id} value={bp.id}>
                  {bp.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {bodyPartIds.length > 0 && (
          <div className={styles.bodyPartTags}>
            {bodyPartIds.map((id) => {
              const bp = bodyPartsById.get(id);
              if (!bp) return null;
              return (
                <span
                  key={id}
                  className={`${styles.bodyPartTag} ${bp.type === "joint" ? styles.bodyPartTagJoint : styles.bodyPartTagMuscle}`}
                >
                  {bp.name}
                  <button type="button" className={styles.bodyPartTagRemove} onClick={() => removeBodyPart(id)}>
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.field}>
        <label>Equipment needed</label>
        <select value="" onChange={(e) => addEquipment(e.target.value)}>
          <option value="">Add equipment…</option>
          {availableEquipment.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.name}
            </option>
          ))}
        </select>
        {equipmentIds.length > 0 && (
          <div className={styles.bodyPartTags}>
            {equipmentIds.map((id) => {
              const eq = equipmentById.get(id);
              if (!eq) return null;
              return (
                <span key={id} className={styles.equipmentTag}>
                  {eq.icon_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={eq.icon_url} alt="" className={styles.equipmentTagIcon} />
                  )}
                  {eq.name}
                  <button type="button" className={styles.bodyPartTagRemove} onClick={() => removeEquipment(id)}>
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div className={styles.fieldHint}>Shown as an icon strip at the top of any session containing this exercise. No equipment needed is a valid state.</div>
      </div>

      <div className={styles.idPreview}>{existing ? `Stable ID: ${existing.id}` : `Will be saved as ${nextExerciseId}`}</div>

      {saveError && <div className={styles.saveError}>{saveError}</div>}

      <div className={styles.builderActions}>
        {existing && (
          <button type="button" className={styles.btnGhost} onClick={onDone}>
            Cancel
          </button>
        )}
        <button type="button" className={styles.btnPrimary} disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : existing ? "Save changes" : "Add to library"}
        </button>
      </div>
    </div>
  );
}
