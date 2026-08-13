"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ClientDashboard.module.css";

export type EditableDetails = {
  first_name: string;
  last_name: string | null;
  email: string;
  date_of_birth: string | null;
  occupation: string | null;
  sport: string | null;
  assigned_clinician: string | null;
  clinic_location: string | null;
};

export default function EditDetailsButton({ patientId, initial }: { patientId: string; initial: EditableDetails }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(initial.first_name);
  const [lastName, setLastName] = useState(initial.last_name ?? "");
  const [email, setEmail] = useState(initial.email);
  const [dateOfBirth, setDateOfBirth] = useState(initial.date_of_birth ?? "");
  const [occupation, setOccupation] = useState(initial.occupation ?? "");
  const [sport, setSport] = useState(initial.sport ?? "");
  const [clinician, setClinician] = useState(initial.assigned_clinician ?? "");
  const [location, setLocation] = useState(initial.clinic_location ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFirstName(initial.first_name);
    setLastName(initial.last_name ?? "");
    setEmail(initial.email);
    setDateOfBirth(initial.date_of_birth ?? "");
    setOccupation(initial.occupation ?? "");
    setSport(initial.sport ?? "");
    setClinician(initial.assigned_clinician ?? "");
    setLocation(initial.clinic_location ?? "");
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName || null,
          email,
          date_of_birth: dateOfBirth || null,
          occupation: occupation || null,
          sport: sport || null,
          assigned_clinician: clinician || null,
          clinic_location: location || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnGhost}`}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Edit details
      </button>

      {open && (
        <div className={styles.modalOverlay} onClick={() => !saving && setOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Edit details</div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>First name</label>
                <input className={styles.fieldInput} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Last name</label>
                <input className={styles.fieldInput} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Email</label>
              <input className={styles.fieldInput} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Date of birth</label>
              <input
                className={styles.fieldInput}
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Occupation</label>
                <input className={styles.fieldInput} value={occupation} onChange={(e) => setOccupation(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Main sport</label>
                <input className={styles.fieldInput} value={sport} onChange={(e) => setSport(e.target.value)} />
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Assigned clinician</label>
                <input className={styles.fieldInput} value={clinician} onChange={(e) => setClinician(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Clinic location</label>
                <input className={styles.fieldInput} value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
            </div>

            {error && <div className={styles.modalError}>{error}</div>}

            <div className={styles.modalActions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
