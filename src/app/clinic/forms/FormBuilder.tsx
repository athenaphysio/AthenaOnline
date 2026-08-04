"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../clinic.module.css";
import { useUnsavedChanges } from "../useUnsavedChanges";

export type QuestionType = "short_text" | "long_text" | "multiple_choice" | "scale" | "yes_no";

export type QuestionInput = {
  key: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  required: boolean;
};

const TYPE_LABELS: Record<QuestionType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  multiple_choice: "Multiple choice",
  scale: "Scale (1-5)",
  yes_no: "Yes / No",
};

let keyCounter = 0;
function newKey(): string {
  keyCounter += 1;
  return `new-${Date.now()}-${keyCounter}`;
}

function emptyQuestion(): QuestionInput {
  return { key: newKey(), type: "short_text", prompt: "", options: ["", ""], required: true };
}

type Props = {
  mode: "create" | "edit";
  formId: string;
  initialTitle: string;
  initialQuestions: QuestionInput[];
};

export default function FormBuilder({ mode, formId, initialTitle, initialQuestions }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [questions, setQuestions] = useState<QuestionInput[]>(
    initialQuestions.length > 0 ? initialQuestions : [emptyQuestion()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { markSaved } = useUnsavedChanges({ title, questions });

  function updateQuestion(key: string, patch: Partial<QuestionInput>) {
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));
    setSaved(false);
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()]);
    setSaved(false);
  }

  function removeQuestion(key: string) {
    setQuestions((prev) => prev.filter((q) => q.key !== key));
    setSaved(false);
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setQuestions((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  }

  function updateOption(key: string, optionIndex: number, value: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === key ? { ...q, options: q.options.map((o, i) => (i === optionIndex ? value : o)) } : q
      )
    );
    setSaved(false);
  }

  function addOption(key: string) {
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, options: [...q.options, ""] } : q)));
  }

  function removeOption(key: string, optionIndex: number) {
    setQuestions((prev) =>
      prev.map((q) => (q.key === key ? { ...q, options: q.options.filter((_, i) => i !== optionIndex) } : q))
    );
  }

  const isValid =
    title.trim().length > 0 &&
    questions.length > 0 &&
    questions.every(
      (q) => q.prompt.trim().length > 0 && (q.type !== "multiple_choice" || q.options.filter((o) => o.trim()).length >= 2)
    );

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: formId,
        title,
        questions: questions.map((q) => ({
          type: q.type,
          prompt: q.prompt.trim(),
          options: q.type === "multiple_choice" ? q.options.map((o) => o.trim()).filter(Boolean) : null,
          required: q.required,
        })),
      };
      const res = await fetch(mode === "create" ? "/api/clinic/forms" : `/api/clinic/forms/${formId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setSaved(true);
      markSaved({ title, questions });
      if (mode === "create") {
        router.push(`/clinic/forms/${formId}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* A light card, not a bare field on the canvas -- see the matching
          comment in BlockBuilder.tsx. */}
      <div className={clinicStyles.card}>
        <div className={clinicStyles.field} style={{ marginBottom: 0 }}>
          <label className={clinicStyles.label}>Form title</label>
          <input
            className={clinicStyles.input}
            placeholder="e.g. New client intake"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaved(false);
            }}
          />
        </div>
      </div>

      {questions.map((q, index) => (
        <div key={q.key} className={clinicStyles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label className={clinicStyles.label}>Question</label>
              <input
                className={clinicStyles.input}
                placeholder="e.g. How long have you had this pain?"
                value={q.prompt}
                onChange={(e) => updateQuestion(q.key, { prompt: e.target.value })}
              />
            </div>
            <div style={{ width: 180 }}>
              <label className={clinicStyles.label}>Type</label>
              <select
                className={clinicStyles.input}
                value={q.type}
                onChange={(e) => updateQuestion(q.key, { type: e.target.value as QuestionType })}
              >
                {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {q.type === "multiple_choice" && (
            <div style={{ marginBottom: 10 }}>
              <div className={clinicStyles.label}>Options</div>
              {q.options.map((opt, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <input
                    className={clinicStyles.input}
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => updateOption(q.key, i, e.target.value)}
                  />
                  <button
                    type="button"
                    className={clinicStyles.iconButtonDanger}
                    onClick={() => removeOption(q.key, i)}
                    disabled={q.options.length <= 2}
                    aria-label="Remove option"
                  >
                    🗑
                  </button>
                </div>
              ))}
              <button type="button" className={clinicStyles.iconButton} onClick={() => addOption(q.key)}>
                + Add option
              </button>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--stone)" }}>
              <input
                type="checkbox"
                checked={q.required}
                onChange={(e) => updateQuestion(q.key, { required: e.target.checked })}
              />
              Required
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className={clinicStyles.iconButton}
                onClick={() => moveQuestion(index, -1)}
                disabled={index === 0}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className={clinicStyles.iconButton}
                onClick={() => moveQuestion(index, 1)}
                disabled={index === questions.length - 1}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className={clinicStyles.iconButtonDanger}
                onClick={() => removeQuestion(q.key)}
                disabled={questions.length <= 1}
                aria-label="Remove question"
              >
                🗑
              </button>
            </div>
          </div>
        </div>
      ))}

      <button type="button" className={clinicStyles.buttonSecondary} onClick={addQuestion}>
        + Add question
      </button>

      {error && (
        <div className={clinicStyles.error} style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      <button
        type="button"
        className={clinicStyles.button}
        style={{ marginTop: 20, width: "auto", padding: "0 24px" }}
        disabled={saving || !isValid}
        onClick={handleSave}
      >
        {saving ? "Saving…" : saved ? "Saved" : mode === "edit" ? "Save changes" : "Create form"}
      </button>
    </div>
  );
}
