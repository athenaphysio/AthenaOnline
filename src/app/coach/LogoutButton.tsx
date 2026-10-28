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
      style={{ background: "none", border: "1px solid rgba(255,255,255,.35)", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}
    >
      Log out
    </button>
  );
}
