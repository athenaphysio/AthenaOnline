"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../session/TodaySession.module.css";

export type FormQuestion = {
  id: string;
  question_order: number;
  type: "short_text" | "long_text" | "multiple_choice" | "scale" | "yes_no";
  prompt: string;
  options: string[] | null;
  required: boolean;
};

export default function FormAnswerClient({ sendId, questions }: { sendId: string; questions: FormQuestion[] }) {
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
    try {
      const res = await fetch(`/api/session/forms/${sendId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: questions
            .filter((q) => answers[q.id]?.trim())
            .map((q) => ({ question_id: q.id, answer_text: answers[q.id].trim() })),
        }),
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
        disabled={submitting || missingRequired}
        onClick={handleSubmit}
      >
        {submitting ? "Sending…" : "Submit"}
      </button>
    </div>
  );
}
