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

type Patient = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_phone: string | null;
  treatment_consent_signed_at: string | null;
  wearable_tracking_enabled: boolean | null;
  diary_planner_enabled: boolean | null;
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// The Me tab: the client's own details, their consent, and anything
// waiting for them to fill in.
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
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
  const canMessage = ctx.layout.tabs.messages === true;

  return (
    <ClientShell ctx={ctx} active="me" title="Me" lead="Your details, your consent, your connected apps, and anything waiting for you.">
      <div className={styles.stack}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Waiting for you</h2>
          {forms.length === 0 ? (
            <p className={styles.muted}>Nothing to fill in at the moment.</p>
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
            <h2 className={styles.cardTitle}>Your diary</h2>
            <p className={styles.muted} style={{ marginBottom: 10 }}>
              Fit your practice around your working week, link Google Calendar, and let your PA place sessions for you.
            </p>
            <Link href="/session/diary" className={styles.rowLink}>
              Plan this week and next →
            </Link>
          </div>
        )}

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Your details</h2>
          <dl className={styles.detail}>
            <dt>Name</dt>
            <dd>{name || "Not recorded"}</dd>
            <dt>Email</dt>
            <dd>{p?.email || "Not recorded"}</dd>
            <dt>Mobile</dt>
            <dd>{p?.mobile_phone || "Not recorded"}</dd>
          </dl>
          <p className={styles.muted} style={{ marginTop: 10 }}>
            {canMessage ? (
              <>
                If anything here needs changing, <Link href="/session/messages">send the team a message</Link> and it will be updated for you.
              </>
            ) : (
              "If anything here needs changing, let the clinic know and it will be updated for you."
            )}
          </p>
        </div>

        {/* Apps that send data into the client's programme. New ones (a
            direct Garmin link, for example) go here as another row. */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Connected apps</h2>
          <p className={styles.muted} style={{ marginBottom: 10 }}>
            Link the apps you train with, so your sessions reach your programme without you typing anything in. You can unlink any of
            them at any time.
          </p>
          <Link href="/session/concept2" className={styles.rowLink}>
            Concept2 Logbook, for your rows on the PM5:{" "}
            {concept2
              ? `connected${concept2.last_synced_at ? `, last read ${fmt(concept2.last_synced_at)}` : ""}`
              : "not connected"}{" "}
            →
          </Link>
          <Link href="/session/workouts" className={styles.rowLink}>
            Upload a workout file, from your Wattbike, watch, Zwift or any other app →
          </Link>
          <Link href="/session/training-data" className={styles.rowLink}>
            Add training data: a logbook export, a test or race result, or a screenshot →
          </Link>
          {WEARABLE_CONNECTIONS_LIVE && p?.wearable_tracking_enabled && (
            <Link href="/session/wearable" className={styles.rowLink}>
              Your watch or wearable, such as Garmin →
            </Link>
          )}
        </div>

        {/* Everything about how the client's information is handled, in
            one place: the published documents, their consents and who can
            see their record, and how to ask for a copy or a change. */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Your information</h2>
          <p className={styles.muted} style={{ marginBottom: 10 }}>
            How we look after your information, who can see it, and the choices you have made. You can read any of these at any time.
          </p>
          <Link href={`/legal/privacy${brandQuery}`} className={styles.rowLink}>
            Privacy notice: what we collect, why, where it is kept and your rights →
          </Link>
          <Link href={`/legal/terms${brandQuery}`} className={styles.rowLink}>
            Terms: how the programme and the app work →
          </Link>
          <Link href={`/legal/cookies${brandQuery}`} className={styles.rowLink}>
            Cookies: the small files the app keeps on your device →
          </Link>
          {consents.map((c) => (
            <Link key={c.packageId} href={`/session/consent/${c.packageId}`} className={styles.rowLink}>
              Who can see your record ({c.packageName}):{" "}
              {c.status.state === "signed"
                ? "you have given your consent"
                : c.status.state === "withdrawn"
                  ? "you have withdrawn your consent"
                  : c.status.state === "needs_resign"
                    ? "please review the updated list"
                    : "waiting for your consent"}{" "}
              →
            </Link>
          ))}
          <p className={styles.muted} style={{ marginTop: 10 }}>
            {p?.treatment_consent_signed_at
              ? `You agreed to the privacy notice and terms on ${fmt(p.treatment_consent_signed_at)}.`
              : "Your agreement to the privacy notice and terms has not been recorded in the app yet."}
          </p>
          <a href={requestHref} className={styles.rowLink}>
            Ask for a copy of your information, a correction or a deletion →
          </a>
          <p className={styles.muted} style={{ marginTop: 6 }}>
            We answer every request within one month, and there is no charge.
          </p>
        </div>
      </div>
    </ClientShell>
  );
}
