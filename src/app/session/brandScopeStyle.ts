import type { CSSProperties } from "react";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";

// Shared by every screen under /session that renders its own .app root
// (TodaySession, OpenRoutine, RestDayScreen) -- scoped CSS custom property
// override, skipped entirely when resolution landed on the default pack
// so the common case has zero inline style and zero risk of drifting from
// today's exact colours.
export function brandScopeStyle(brand?: ResolvedBrandPack): CSSProperties | undefined {
  if (!brand || brand.isAllDefault) return undefined;
  return { "--crimson": brand.accent_color, "--cream": brand.background_color } as CSSProperties;
}
