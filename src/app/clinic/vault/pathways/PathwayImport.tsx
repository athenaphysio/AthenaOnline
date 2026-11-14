"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";
import styles from "./Pathways.module.css";

// Paste a pathway's code in from the Clinical Pathways Project. A pathway
// with the same name is replaced, so a revised version updates in place.
export default function PathwayImport() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setErrors([]);
    const res = await fetch("/api/clinic/vault/pathways", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; errors?: string[] };
    setSaving(false);
    if (!res.ok || !body.id) {
      setErrors(body.errors ?? ["Something went wrong saving that pathway."]);
      return;
    }
    router.push(`/clinic/vault/pathways/${body.id}`);
  }

  if (!open) {
    return (
      <div className={clinicStyles.actions} style={{ marginTop: 16, marginBottom: 0 }}>
        <button type="button" className={clinicStyles.buttonSecondary} onClick={() => setOpen(true)}>
          + Paste pathway code
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <textarea
        className={styles.codeBox}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder='Paste the athena-pathway-v1 code block here, starting with { "format": "athena-pathway-v1"'
        autoFocus
      />
      {errors.length > 0 && (
        <ul className={styles.errors}>
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className={clinicStyles.actions} style={{ marginTop: 10, marginBottom: 0 }}>
        <button type="button" className={clinicStyles.button} disabled={saving || !code.trim()} onClick={save}>
          {saving ? "Saving" : "Save pathway"}
        </button>
        <button type="button" className={clinicStyles.buttonSecondary} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
