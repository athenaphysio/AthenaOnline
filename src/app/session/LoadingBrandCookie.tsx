"use client";

import { useEffect } from "react";
import { LOADING_BRAND_COOKIE, encodeLoadingBrand, type LoadingBrand } from "@/lib/loadingBrand";

// Renders nothing. Remembers how the landing page looked so the holding
// page can open in the same style next time (see src/lib/loadingBrand.ts).
export default function LoadingBrandCookie(props: LoadingBrand) {
  const { theme, wordmarkUrl, textureUrl, accent, canvas } = props;
  useEffect(() => {
    try {
      const value = encodeLoadingBrand({ theme, wordmarkUrl, textureUrl, accent, canvas });
      const secure = window.location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${LOADING_BRAND_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax${secure}`;
    } catch {
      // A holding page in the default style is a perfectly good fallback.
    }
  }, [theme, wordmarkUrl, textureUrl, accent, canvas]);
  return null;
}
