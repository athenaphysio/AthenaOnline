"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/coach/logout", { method: "POST" });
        router.replace("/coach/login");
      }}
      style={{ background: "none", border: "1px solid var(--clinic-on-canvas-muted)", color: "var(--clinic-on-canvas)", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}
    >
      Log out
    </button>
  );
}
