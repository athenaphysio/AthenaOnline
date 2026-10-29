import type { ReactNode } from "react";
import SiteBanner from "../SiteBanner";
import AppTabBar from "@/components/app/AppTabBar";
import { clientRootStyle } from "../ClientShell";
import type { ClientAppContext } from "@/lib/clientApp";
import sessionStyles from "../TodaySession.module.css";

// My Passport inside the client's brand. The passport screens are drawn
// for a light page, so on a dark pack they sit on a light panel.
export default function PassportShell({ ctx, children }: { ctx: ClientAppContext; children: ReactNode }) {
  const { dark, style } = clientRootStyle(ctx.brand);
  return (
    <div className={dark ? `${sessionStyles.app} ${sessionStyles.appDark}` : sessionStyles.app} style={style}>
      {!ctx.brand.isAllDefault && <SiteBanner brand={ctx.brand} />}
      <div className={sessionStyles.inner}>
        {dark ? (
          <div style={{ background: "#f2ede4", color: "#1c1c1c", borderRadius: 20, margin: "14px 10px 0", padding: "6px 0 10px", overflow: "hidden" }}>{children}</div>
        ) : (
          children
        )}
      </div>
      <AppTabBar tabs={ctx.tabs} active="passport" dark={dark} />
    </div>
  );
}
