"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import listStyles from "../CardioProgrammes.module.css";

type Props = {
  programmeId: string;
  initialStatus: "pending" | "reviewed";
};

export default function ReviewToggleButton({ programmeId, initialStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = status === "pending" ? "reviewed" : "pending";
    setSaving(true);
    try {
      const res = await fetch(`/api/clinic/cardio-programmes/${programmeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_status: next }),
      });
      if (res.ok) {
        setStatus(next);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      className={`${listStyles.reviewButton} ${status === "pending" ? listStyles.pendingTag : listStyles.reviewedTag}`}
    >
      {status === "pending" ? "Pending review, mark reviewed" : "Reviewed, mark pending"}
    </button>
  );
}
