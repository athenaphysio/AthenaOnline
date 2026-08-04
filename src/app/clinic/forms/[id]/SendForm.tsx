"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PatientPicker, { type Patient } from "../../PatientPicker";
import clinicStyles from "../../clinic.module.css";

type Props = {
  formId: string;
  groups: { id: string; name: string }[];
};

export default function SendForm({ formId, groups }: Props) {
  const router = useRouter();
  const [target, setTarget] = useState<"patient" | "group">("patient");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [groupId, setGroupId] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    setSentMessage(null);
    try {
      const res = await fetch(`/api/clinic/forms/${formId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target === "patient" ? { patient_id: patient?.id } : { group_id: groupId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed.");
      setSentMessage(`Sent to ${data.sent} ${data.sent === 1 ? "person" : "people"}.`);
      setPatient(null);
      setGroupId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Send this form</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <button
          type="button"
          className={target === "patient" ? clinicStyles.button : clinicStyles.buttonSecondary}
          style={{ width: "auto", padding: "0 16px" }}
          onClick={() => setTarget("patient")}
        >
          A patient
        </button>
        <button
          type="button"
          className={target === "group" ? clinicStyles.button : clinicStyles.buttonSecondary}
          style={{ width: "auto", padding: "0 16px" }}
          onClick={() => setTarget("group")}
        >
          A group
        </button>
      </div>

      {target === "patient" ? (
        <PatientPicker selected={patient} onSelect={setPatient} />
      ) : (
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Group</label>
          <select className={clinicStyles.input} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Choose a group…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className={clinicStyles.error} style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
      {sentMessage && (
        <p style={{ fontSize: 13.5, color: "var(--stone)", marginTop: 12 }}>{sentMessage}</p>
      )}

      <button
        type="button"
        className={clinicStyles.button}
        style={{ marginTop: 16, width: "auto", padding: "0 24px" }}
        disabled={sending || (target === "patient" ? !patient : !groupId)}
        onClick={handleSend}
      >
        {sending ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
