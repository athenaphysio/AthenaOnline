"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Sends a form straight to the client whose page this is: pick a form,
// press Send. Uses the same send route as the Forms library, so the client
// gets the usual in-app notification.
export default function SendFormPicker({
  patientId,
  forms,
  selectClassName,
  buttonClassName,
}: {
  patientId: string;
  forms: { id: string; title: string }[];
  selectClassName?: string;
  buttonClassName?: string;
}) {
  const router = useRouter();
  const [formId, setFormId] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function send() {
    if (!formId) return;
    setState("sending");
    try {
      const res = await fetch(`/api/clinic/forms/${formId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patientId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The form couldn't be sent.");
      setState("sent");
      setFormId("");
      router.refresh();
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  if (forms.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <select
        className={selectClassName}
        value={formId}
        onChange={(e) => {
          setFormId(e.target.value);
          setState("idle");
        }}
        aria-label="Choose a form to send"
        style={{ height: 36, padding: "0 10px", borderRadius: 8, minWidth: 200, fontSize: 14 }}
      >
        <option value="">Choose a form…</option>
        {forms.map((f) => (
          <option key={f.id} value={f.id}>
            {f.title}
          </option>
        ))}
      </select>
      <button type="button" className={buttonClassName} onClick={send} disabled={!formId || state === "sending"}>
        {state === "sending" ? "Sending…" : state === "sent" ? "Sent" : "Send"}
      </button>
      {state === "error" && <span style={{ fontSize: 13, color: "var(--crimson, #9B1C1C)" }}>{error}</span>}
    </div>
  );
}
