"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../session/TodaySession.module.css";

export type FormQuestion = {
  id: string;
  question_order: number;
  type: "short_text" | "long_text" | "multiple_choice" | "multi_select" | "scale" | "yes_no";
  prompt: string;
  options: string[] | null;
  required: boolean;
};

// A "tick all that apply" answer is stored as the ticked options joined by
// semicolons, so it reads naturally anywhere answers are shown. An option
// such as "None of these", "Don't know" or "Not applicable" stands alone:
// ticking it clears the others, and ticking another clears it.
const TICK_SEPARATOR = "; ";
const isStandalone = (opt: string) => /^(none|don.t know|not applicable)/i.test(opt.trim());

function splitTicks(value: string | undefined): string[] {
  return value ? value.split(TICK_SEPARATOR).filter(Boolean) : [];
}

function toggleTick(chosen: string[], opt: string, on: boolean): string {
  let next = on ? [...chosen, opt] : chosen.filter((c) => c !== opt);
  if (on) next = isStandalone(opt) ? [opt] : next.filter((c) => !isStandalone(c));
  return next.join(TICK_SEPARATOR);
}

export type SubmittedAnswer = { question_id: string; answer_text: string };

// Used in the app (a form sent to a logged in client, by sendId) and on the
// public intake page, which passes its own onSubmit and can hold the Submit
// button back until its own fields are filled in.
export default function FormAnswerClient({
  sendId,
  questions,
  onSubmit,
  blocked = false,
  submitLabel = "Submit",
}: {
  sendId?: string;
  questions: FormQuestion[];
  onSubmit?: (answers: SubmittedAnswer[]) => Promise<void>;
  blocked?: boolean;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  const missingRequired = questions.some((q) => q.required && !answers[q.id]?.trim());

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const given = questions
      .filter((q) => answers[q.id]?.trim())
      .map((q) => ({ question_id: q.id, answer_text: answers[q.id].trim() }));
    try {
      if (onSubmit) {
        await onSubmit(given);
        return;
      }
      const res = await fetch(`/api/session/forms/${sendId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: given }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className={styles.list}>
        {questions.map((q) => (
          <div key={q.id} className={styles.card} style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 15, color: "var(--charcoal)", marginBottom: 12 }}>
              {q.prompt}
              {!q.required && <span style={{ color: "var(--muted)", fontSize: 12.5 }}> (optional)</span>}
            </div>

            {q.type === "short_text" && (
              <input
                style={{
                  width: "100%",
                  height: 44,
                  fontFamily: "inherit",
                  fontSize: 14,
                  color: "var(--charcoal)",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 9,
                  padding: "0 14px",
                }}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
            )}

            {q.type === "long_text" && (
              <textarea
                style={{
                  width: "100%",
                  minHeight: 90,
                  fontFamily: "inherit",
                  fontSize: 14,
                  color: "var(--charcoal)",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 9,
                  padding: 12,
                }}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
            )}

            {q.type === "multiple_choice" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(q.options ?? []).map((opt) => (
                  <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswer(q.id, opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {q.type === "multi_select" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 12.5, color: "var(--stone)" }}>Tick all that apply</span>
                {(q.options ?? []).map((opt) => {
                  const chosen = splitTicks(answers[q.id]);
                  return (
                    <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={chosen.includes(opt)}
                        onChange={(e) => setAnswer(q.id, toggleTick(chosen, opt, e.target.checked))}
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            )}

            {q.type === "scale" && (
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`${styles.doneButton} ${answers[q.id] === String(n) ? styles.isDone : ""}`}
                    style={{ width: 44 }}
                    onClick={() => setAnswer(q.id, String(n))}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}

            {q.type === "yes_no" && (
              <div style={{ display: "flex", gap: 10 }}>
                {["Yes", "No"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`${styles.doneButton} ${answers[q.id] === opt ? styles.isDone : ""}`}
                    onClick={() => setAnswer(q.id, opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p style={{ color: "var(--crimson-dark)", fontSize: 13.5, textAlign: "center", margin: "12px 22px 0" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        className={styles.doneButton}
        style={{ margin: "16px 16px 0", width: "calc(100% - 32px)" }}
        disabled={submitting || missingRequired || blocked}
        onClick={handleSubmit}
      >
        {submitting ? "Sending…" : submitLabel}
      </button>
    </div>
  );
}
