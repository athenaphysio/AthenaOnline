import type { ReactNode } from "react";
import styles from "./TodaySession.module.css";
import SessionHeader from "./SessionHeader";
import { brandScopeStyle, paletteAttr } from "./brandScopeStyle";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";
import type { BackTarget } from "./BackLink";
import { translator } from "@/i18n/translate";
import type { Lang } from "@/i18n/languages";

export default function RestDayScreen({
  firstName,
  banner,
  brand,
  back,
  lang = "en",
}: {
  back?: BackTarget;
  lang?: Lang;
  firstName: string;
  banner?: ReactNode;
  brand?: ResolvedBrandPack;
}) {
  const { t } = translator(lang);
  return (
    <div className={styles.app} style={brandScopeStyle(brand)} {...paletteAttr(brand)}>
      <div className={styles.inner}>
        <SessionHeader firstName={firstName} greeting={t("practice.greetingHi")} eyebrow={t("practice.restDay")} banner={banner} brand={brand} back={back} />
        <p style={{ padding: "0 22px", fontSize: 14, color: "var(--stone)", lineHeight: 1.55 }}>
          {t("practice.restDayBody")}
        </p>
      </div>
    </div>
  );
}
