"use client";

import { useEffect } from "react";
import { BRAND_PACK_COOKIE, BRAND_PACK_COOKIE_MAX_AGE } from "@/lib/brandPackCookie";

// Renders nothing. Remembers which brand this phone belongs to (see
// src/lib/brandPackCookie.ts). A null pack forgets it, so a phone handed to
// a client on standard Athena branding goes back to the Athena login.
export default function BrandPackCookie({ packId }: { packId: string | null }) {
  useEffect(() => {
    try {
      const secure = window.location.protocol === "https:" ? "; secure" : "";
      document.cookie = packId
        ? `${BRAND_PACK_COOKIE}=${packId}; path=/; max-age=${BRAND_PACK_COOKIE_MAX_AGE}; samesite=lax${secure}`
        : `${BRAND_PACK_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
    } catch {
      // The Athena login page is a perfectly good fallback.
    }
  }, [packId]);
  return null;
}
