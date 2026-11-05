"use client";

import { useState } from "react";
import clinicStyles from "../../clinic.module.css";

export default function CopyLogButton({
  planId,
  url,
  label = "Copy log for Claude",
  className,
}: {
  planId?: string;
  url?: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");

  async function copy() {
    setState("loading");
    try {
      const res = await fetch(url ?? `/api/clinic/imported-plans/${planId}/log`);
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
      className={className ?? clinicStyles.buttonSecondary}
      style={className ? undefined : { width: "auto", padding: "0 16px", height: 32, fontSize: 13 }}
      onClick={copy}
      disabled={state === "loading"}
    >
      {state === "loading" ? "…" : state === "copied" ? "Copied" : state === "error" ? "Couldn't copy" : label}
    </button>
  );
}
