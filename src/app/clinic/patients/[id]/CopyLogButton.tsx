"use client";

import { useState } from "react";
import clinicStyles from "../../clinic.module.css";

export default function CopyLogButton({ planId }: { planId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");

  async function copy() {
    setState("loading");
    try {
      const res = await fetch(`/api/clinic/imported-plans/${planId}/log`);
      const data = await res.json();
      await navigator.clipboard.writeText(data.text);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      className={clinicStyles.buttonSecondary}
      style={{ width: "auto", padding: "0 16px", height: 32, fontSize: 13 }}
      onClick={copy}
      disabled={state === "loading"}
    >
      {state === "loading" ? "…" : state === "copied" ? "Copied" : state === "error" ? "Couldn't copy" : "Copy log for Claude"}
    </button>
  );
}
