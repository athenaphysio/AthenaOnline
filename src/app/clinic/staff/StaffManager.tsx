"use client";

import { useState } from "react";
import clinicStyles from "../clinic.module.css";

export type Coach = { id: string; name: string; email: string; created_at: string };
export type TemplateOption = { id: string; name: string };
export type Assignment = { coach_id: string; template_id: string };

type Props = {
  initialCoaches: Coach[];
  templates: TemplateOption[];
  initialAssignments: Assignment[];
};

export default function StaffManager({ initialCoaches, templates, initialAssignments }: Props) {
  const [coaches, setCoaches] = useState<Coach[]>(initialCoaches);
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/clinic/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed.");
      setCoaches((prev) => [
        { id: data.id, name: name.trim(), email: email.trim(), created_at: new Date().toISOString() },
        ...prev,
      ]);
      setJustCreated(email.trim());
      setName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setCreating(false);
    }
  }

  function isAssigned(coachId: string, templateId: string) {
    return assignments.some((a) => a.coach_id === coachId && a.template_id === templateId);
  }

  async function toggleAssignment(coachId: string, templateId: string) {
    const currentlyAssigned = isAssigned(coachId, templateId);
    setAssignments((prev) =>
      currentlyAssigned
        ? prev.filter((a) => !(a.coach_id === coachId && a.template_id === templateId))
        : [...prev, { coach_id: coachId, template_id: templateId }]
    );
    try {
      const res = currentlyAssigned
        ? await fetch(`/api/clinic/staff/${coachId}/assignments?template_id=${templateId}`, { method: "DELETE" })
        : await fetch(`/api/clinic/staff/${coachId}/assignments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ template_id: templateId }),
          });
      if (!res.ok) throw new Error("Failed.");
    } catch {
      // Revert the optimistic update on failure.
      setAssignments((prev) =>
        currentlyAssigned
          ? [...prev, { coach_id: coachId, template_id: templateId }]
          : prev.filter((a) => !(a.coach_id === coachId && a.template_id === templateId))
      );
    }
  }

  return (
    <div>
      <div className={clinicStyles.card}>
        <div className={clinicStyles.cardTitle}>Create Coach account</div>
        <div className={clinicStyles.row2}>
          <div className={clinicStyles.field}>
            <label className={clinicStyles.label}>Name</label>
            <input className={clinicStyles.input} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className={clinicStyles.field}>
            <label className={clinicStyles.label}>Email</label>
            <input
              type="email"
              className={clinicStyles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Password (at least 8 characters)</label>
          <input
            type="text"
            className={clinicStyles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Share this with them directly"
          />
        </div>
        {createError && <div className={clinicStyles.error}>{createError}</div>}
        <button
          type="button"
          className={clinicStyles.button}
          style={{ width: "auto", padding: "0 20px" }}
          disabled={creating || !name.trim() || !email.trim() || password.length < 8}
          onClick={handleCreate}
        >
          {creating ? "Creating…" : "Create Coach account"}
        </button>
        {justCreated && (
          <p style={{ fontSize: 13, color: "var(--stone)", marginTop: 10 }}>
            Account created for {justCreated}. They can log in at /coach/login with the email and password
            above.
          </p>
        )}
      </div>

      <div className={clinicStyles.cardTitle} style={{ marginTop: 24 }}>
        Coaches
      </div>
      {coaches.length === 0 && (
        <p className={clinicStyles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
          No coaches yet.
        </p>
      )}

      {coaches.map((coach) => {
        const count = assignments.filter((a) => a.coach_id === coach.id).length;
        const isOpen = expanded === coach.id;
        return (
          <div key={coach.id} className={clinicStyles.card} style={{ padding: "14px 18px" }}>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              onClick={() => setExpanded(isOpen ? null : coach.id)}
            >
              <div>
                <div className={clinicStyles.cardTitle} style={{ margin: 0, fontSize: 16 }}>
                  {coach.name}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>{coach.email}</div>
              </div>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {count} template{count === 1 ? "" : "s"} assigned
              </span>
            </div>

            {isOpen && (
              <div style={{ marginTop: 14 }}>
                {templates.length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--muted)" }}>
                    No templates yet — build one in Programme Templates first.
                  </p>
                )}
                {templates.map((t) => (
                  <label
                    key={t.id}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 14 }}
                  >
                    <input
                      type="checkbox"
                      checked={isAssigned(coach.id, t.id)}
                      onChange={() => toggleAssignment(coach.id, t.id)}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
