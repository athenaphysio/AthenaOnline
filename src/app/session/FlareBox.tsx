"use client";

import { useState } from "react";
import styles from "./TodaySession.module.css";
import { useT } from "@/i18n/client";

// "Having a flare-up?" on a running card: the plan's own flare rule, the
// safety line, and repeating the week. Shared by plan-code run cards and
// Run Circuits.
export default function FlareBox({
  programmeId,
  weekNumber,
  flareRuleText,
}: {
  programmeId: string;
  weekNumber: number;
  flareRuleText: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function repeat() {
    setSubmitting(true);
    try {
      await fetch("/api/session/repeat-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programme_id: programmeId, week_number: weekNumber, kind: "flare_up" }),
      });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return <p style={{ fontSize: 13, color: "var(--stone)", marginTop: 10 }}>{t("practice.flareNoted")}</p>;
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ marginTop: 10, border: "1px solid var(--stone)", background: "var(--input-bg, #fff)", color: "var(--graphite)", borderRadius: 10, padding: "8px 14px", fontSize: 13 }}
      >
        {t("practice.flareQuestion")}
      </button>
    );
  }
  return (
    <div style={{ marginTop: 10, padding: "12px 14px", background: "var(--mist)", borderRadius: 10 }}>
      <p style={{ fontSize: 13.5, margin: "0 0 10px", lineHeight: 1.5 }}>{flareRuleText}</p>
      <div style={{ background: "var(--crimson-light)", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, color: "var(--crimson-dark)", marginBottom: 10, lineHeight: 1.5 }}>
        {t("practice.flareSafety")}
      </div>
      <button type="button" className={styles.doneButton} disabled={submitting} onClick={repeat}>
        {submitting ? "…" : t("practice.repeatThisWeek")}
      </button>
    </div>
  );
}
