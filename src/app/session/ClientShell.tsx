import type { CSSProperties, ReactNode } from "react";
import { darkCanvasStyle } from "./brandScopeStyle";
import { headingFontStyle } from "@/lib/brandFonts";
import SiteBanner from "./SiteBanner";
import AppTabBar from "@/components/app/AppTabBar";
import type { ClientAppContext } from "@/lib/clientApp";
import type { ToolbarTab } from "@/lib/appLayout";
import styles from "./TodaySession.module.css";

// The frame around every tab of the client's app other than Home: the
// client's brand pack (dark canvas or light page, colours, heading font),
// the banner at the top and the toolbar at the bottom. Home draws its own
// frame in ClientHome, with the same rules.
export function clientRootStyle(brand: ClientAppContext["brand"]): { dark: boolean; style: CSSProperties | undefined } {
  const dark = !brand.isAllDefault && brand.theme === "dark";
  if (dark) return { dark, style: darkCanvasStyle(brand) };
  if (brand.isAllDefault) return { dark, style: undefined };
  return {
    dark,
    style: { "--crimson": brand.accent_color, "--cream": brand.background_color, ...headingFontStyle(brand.heading_font) } as CSSProperties,
  };
}

export default function ClientShell({
  ctx,
  active,
  title,
  lead,
  children,
}: {
  ctx: ClientAppContext;
  active: ToolbarTab["key"];
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  const { dark, style } = clientRootStyle(ctx.brand);
  return (
    <div className={dark ? `${styles.app} ${styles.appDark}` : styles.app} style={style} data-brand-theme={dark ? "dark" : undefined}>
      <SiteBanner brand={ctx.brand} />
      <div className={styles.inner}>
        <div className={styles.head}>
          <h1>{title}</h1>
          {lead && <p>{lead}</p>}
        </div>
        <div style={{ padding: "0 16px" }}>{children}</div>
      </div>
      <AppTabBar tabs={ctx.tabs} active={active} dark={dark} />
    </div>
  );
}
