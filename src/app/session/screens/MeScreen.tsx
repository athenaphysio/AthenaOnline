import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClientShell from "../ClientShell";
import { loadPendingForms, type ClientAppContext } from "@/lib/clientApp";
import styles from "./Screens.module.css";

type Patient = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_phone: string | null;
  treatment_consent_signed_at: string | null;
  wearable_tracking_enabled: boolean | null;
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// The Me tab: the client's own details, their consent, and anything
// waiting for them to fill in.
export default async function MeScreen({ ctx, db }: { ctx: ClientAppContext; db: SupabaseClient }) {
  const [{ data: p }, forms, { data: concept2 }] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select("first_name, last_name, email, mobile_phone, treatment_consent_signed_at, wearable_tracking_enabled")
      .eq("id", ctx.userId)
      .maybeSingle<Patient>(),
    loadPendingForms(db, ctx.userId),
    supabaseAdmin
      .from("concept2_connections")
      .select("last_synced_at")
      .eq("patient_id", ctx.userId)
      .maybeSingle<{ last_synced_at: string | null }>(),
  ]);
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
  const canMessage = ctx.tabs.some((t) => t.key === "messages");

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
          {p?.wearable_tracking_enabled && (
            <Link href="/session/wearable" className={styles.rowLink}>
              Your watch or wearable, such as Garmin →
            </Link>
          )}
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Your consent</h2>
          <p className={styles.muted}>
            {p?.treatment_consent_signed_at
              ? `You gave your consent on ${fmt(p.treatment_consent_signed_at)}.`
              : "Your consent has not been recorded in the app yet."}
          </p>
        </div>
      </div>
    </ClientShell>
  );
}
