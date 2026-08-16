"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../clinic.module.css";
import { useUnsavedChanges } from "../useUnsavedChanges";
import CardioBlockEditor from "../builder/CardioBlockEditor";
import type { CardioBlockDetail } from "@/lib/cardioBlock";

type Props = { mode: "create" | "edit"; initial: CardioBlockDetail };

// A standalone home for a cardio block, same dual create/edit shape as
// BlockBuilder.tsx. Create is two requests chained transparently: the bare
// POST /api/clinic/cardio-blocks (id/name/modality/structure/category, the
// same shape the inline "+ New cardio block" flow in WorkoutBuilder uses),
// then the same PATCH every edit uses to save everything else -- so a fresh
// cardio block never sits half-created even though the underlying API was
// built for the "create bare, fill in inline" workflow.
export default function CardioBlockPageClient({ mode, initial }: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState<CardioBlockDetail>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { markSaved } = useUnsavedChanges(detail);

  function patch(p: Partial<CardioBlockDetail>) {
    setDetail((prev) => ({ ...prev, ...p }));
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        const createRes = await fetch("/api/clinic/cardio-blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: detail.id,
            name: detail.name,
            modality: detail.modality,
            modality_other: detail.modality_other,
            structure: detail.structure,
            category: detail.category,
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || "Couldn't create cardio block.");
      }

      const res = await fetch(`/api/clinic/cardio-blocks/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(detail),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");

      setSaved(true);
      markSaved(detail);
      if (mode === "create") router.push(`/clinic/cardio/${detail.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <CardioBlockEditor cardio={detail} onChange={patch} />

      {error && (
        <div className={clinicStyles.error} style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      <button
        type="button"
        className={clinicStyles.button}
        style={{ marginTop: 20 }}
        disabled={saving || !detail.name.trim()}
        onClick={handleSubmit}
      >
        {saving ? "Saving…" : saved && mode === "edit" ? "Save changes" : "Save cardio block"}
      </button>
    </div>
  );
}
