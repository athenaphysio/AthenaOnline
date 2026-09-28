"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clinicStyles from "../clinic.module.css";

type Props = {
  id: string;
  patientId: string;
  patientName: string;
  fromRung: number;
  toRung: number;
  createdRelative: string;
};

export default function ProgressionEventRow({ id, patientId, patientName, fromRung, toRung, createdRelative }: Props) {
  const router = useRouter();
  const [acting, setActing] = useState<"approve" | "hold" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<"approve" | "hold" | null>(null);

  async function act(action: "approve" | "hold") {
    setActing(action);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/running-progression/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "That didn't work.");
      }
      setResolved(action);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setActing(null);
    }
  }

  return (
    <div style={{ padding: "12px 0", borderTop: "1px solid var(--cream)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <Link href={`/clinic/patients/${patientId}`} style={{ color: "var(--crimson)", fontWeight: 500 }}>
            {patientName}
          </Link>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
            Ready to move from rung {fromRung} to rung {toRung} · {createdRelative}
          </div>
        </div>
        {resolved ? (
          <span className={clinicStyles.statusPill}>{resolved === "approve" ? "Approved" : "Held"}</span>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className={clinicStyles.buttonSecondary}
              style={{ width: "auto", padding: "0 16px", height: 34, fontSize: 13 }}
              disabled={acting !== null}
              onClick={() => act("hold")}
            >
              {acting === "hold" ? "…" : "Hold"}
            </button>
            <button
              type="button"
              className={clinicStyles.button}
              style={{ width: "auto", padding: "0 16px", height: 34, fontSize: 13 }}
              disabled={acting !== null}
              onClick={() => act("approve")}
            >
              {acting === "approve" ? "…" : "Approve"}
            </button>
          </div>
        )}
      </div>
      {error && <div className={clinicStyles.error}>{error}</div>}
    </div>
  );
}
