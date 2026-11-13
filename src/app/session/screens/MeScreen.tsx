import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClientShell from "../ClientShell";
import { loadPendingForms, type ClientAppContext } from "@/lib/clientApp";
import styles from "./Screens.module.css";
import shopStyles from "../../shop/shop.module.css";
import { loadPerformance } from "@/lib/performanceMetricsServer";
import PerformanceMetricsCard from "@/components/performance/PerformanceMetricsCard";
import { clientConsentOverview } from "@/lib/clinicianAccess";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legalDocs";
import { WEARABLE_CONNECTIONS_LIVE } from "@/lib/rookProviders";
import { translator, isReviewed } from "@/i18n/translate";
import { formatDate } from "@/i18n/languages";
import LanguagePicker from "../LanguagePicker";

type Patient = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_phone: string | null;
  treatment_consent_signed_at: string | null;
  wearable_tracking_enabled: boolean | null;
  diary_planner_enabled: boolean | null;
};

// The Me tab: the client's own details, their consent, anything waiting
// for them to fill in, and the language their app is shown in. Words come
// from the client's chosen language (src/i18n). The request email to the
// clinic stays in English, since it is read by the team.
export default async function MeScreen({ ctx, db }: { ctx: ClientAppContext; db: SupabaseClient }) {
  const [{ data: p }, forms, { data: concept2 }, performance, consents] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select("first_name, last_name, email, mobile_phone, treatment_consent_signed_at, wearable_tracking_enabled, diary_planner_enabled")
      .eq("id", ctx.userId)
      .maybeSingle<Patient>(),
    loadPendingForms(db, ctx.userId),
    supabaseAdmin
      .from("concept2_connections")
      .select("last_synced_at")
      .eq("patient_id", ctx.userId)
      .maybeSingle<{ last_synced_at: string | null }>(),
    loadPerformance(ctx.userId),
    clientConsentOverview(ctx.userId).catch(() => []),
  ]);
  // The published documents open in the client's own brand.
  const brandQuery = ctx.brand.isAllDefault ? "" : `?brand=${ctx.brand.id}`;
  const requestHref = `mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent("Request about my information")}&body=${encodeURIComponent(
    `Please tell us what you would like, for example a copy of your information, a correction, or for something to be deleted.\n\nName: ${[p?.first_name, p?.last_name].filter(Boolean).join(" ")}\n`,
  )}`;
  const { t, rich } = translator(ctx.language);
  const fmt = (iso: string) => formatDate(iso, ctx.language);
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
  const canMessage = ctx.layout.tabs.messages === true;

  return (
    <ClientShell ctx={ctx} active="me" title={t("me.title")} lead={t("me.lead")}>
      <div className={styles.stack}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{t("me.waitingTitle")}</h2>
          {forms.length === 0 ? (
            <p className={styles.muted}>{t("me.nothingWaiting")}</p>
          ) : (
            forms.map((f) => (
              <Link key={f.sendId} href={`/forms/${f.sendId}`} className={styles.rowLink}>
                {f.title} →
              </Link>
            ))
          )}
        </div>

        {(performance.goals.length > 0 || performance.tests.length > 0 || performance.candidates.length > 0) && (
          <PerformanceMetricsCard
            data={performance}
            viewer="client"
            endpoint="/api/session/training-data"
            firstName={p?.first_name ?? ""}
            cardClass={styles.card}
            titleClass={styles.cardTitle}
            buttonClass={shopStyles.buyButton}
          />
        )}

        {p?.diary_planner_enabled && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t("me.diaryTitle")}</h2>
            <p className={styles.muted} style={{ marginBottom: 10 }}>
              {t("me.diaryBody")}
            </p>
            <Link href="/session/diary" className={styles.rowLink}>
              {t("me.diaryLink")} →
            </Link>
          </div>
        )}

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{t("me.detailsTitle")}</h2>
          <dl className={styles.detail}>
            <dt>{t("me.name")}</dt>
            <dd>{name || t("me.notRecorded")}</dd>
            <dt>{t("me.email")}</dt>
            <dd>{p?.email || t("me.notRecorded")}</dd>
            <dt>{t("me.mobile")}</dt>
            <dd>{p?.mobile_phone || t("me.notRecorded")}</dd>
          </dl>
          <p className={styles.muted} style={{ marginTop: 10 }}>
            {canMessage ? (
              rich("me.changeWithMessage", { link: <Link href="/session/messages">{t("me.changeLink")}</Link> })
            ) : (
              t("me.changeNoMessage")
            )}
          </p>
        </div>

        {/* Apps that send data into the client's programme. New ones (a
            direct Garmin link, for example) go here as another row. */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{t("apps.title")}</h2>
          <p className={styles.muted} style={{ marginBottom: 10 }}>
            {t("apps.body")}
          </p>
          <Link href="/session/concept2" className={styles.rowLink}>
            {t("apps.concept2", {
              status: concept2
                ? concept2.last_synced_at
                  ? t("apps.connectedLastRead", { date: fmt(concept2.last_synced_at) })
                  : t("apps.connected")
                : t("apps.notConnected"),
            })}{" "}
            →
          </Link>
          <Link href="/session/workouts" className={styles.rowLink}>
            {t("apps.workouts")} →
          </Link>
          <Link href="/session/training-data" className={styles.rowLink}>
            {t("apps.trainingData")} →
          </Link>
          {WEARABLE_CONNECTIONS_LIVE && p?.wearable_tracking_enabled && (
            <Link href="/session/wearable" className={styles.rowLink}>
              {t("apps.wearable")} →
            </Link>
          )}
        </div>

        {/* Everything about how the client's information is handled, in
            one place: the published documents, their consents and who can
            see their record, and how to ask for a copy or a change. */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{t("info.title")}</h2>
          <p className={styles.muted} style={{ marginBottom: 10 }}>
            {t("info.body")}
          </p>
          <Link href={`/legal/privacy${brandQuery}`} className={styles.rowLink}>
            {t("info.privacy")} →
          </Link>
          <Link href={`/legal/terms${brandQuery}`} className={styles.rowLink}>
            {t("info.terms")} →
          </Link>
          <Link href={`/legal/cookies${brandQuery}`} className={styles.rowLink}>
            {t("info.cookies")} →
          </Link>
          {consents.map((c) => (
            <Link key={c.packageId} href={`/session/consent/${c.packageId}`} className={styles.rowLink}>
              {t("info.consentRow", {
                package: c.packageName,
                status:
                  c.status.state === "signed"
                    ? t("info.consentSigned")
                    : c.status.state === "withdrawn"
                      ? t("info.consentWithdrawn")
                      : c.status.state === "needs_resign"
                        ? t("info.consentNeedsResign")
                        : t("info.consentWaiting"),
              })}{" "}
              →
            </Link>
          ))}
          <p className={styles.muted} style={{ marginTop: 10 }}>
            {p?.treatment_consent_signed_at
              ? t("info.agreedOn", { date: fmt(p.treatment_consent_signed_at) })
              : t("info.notAgreed")}
          </p>
          <a href={requestHref} className={styles.rowLink}>
            {t("info.request")} →
          </a>
          <p className={styles.muted} style={{ marginTop: 6 }}>
            {t("info.requestReply")}
          </p>
        </div>

        {/* The language the whole app is shown in. A translation not yet
            checked by a native speaker says so, in that language. */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{t("language.title")}</h2>
          <p className={styles.muted} style={{ marginBottom: 10 }}>
            {t("language.body")}
          </p>
          <LanguagePicker current={ctx.language} label={t("language.label")} errorText={t("language.error")} />
          {!isReviewed(ctx.language) && (
            <p className={styles.muted} style={{ marginTop: 10 }}>
              {t("language.draftNote")}
            </p>
          )}
        </div>
      </div>
    </ClientShell>
  );
}
