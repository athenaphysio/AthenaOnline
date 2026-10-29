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
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// The Me tab: the client's own details, their consent, and anything
// waiting for them to fill in.
export default async function MeScreen({ ctx, db }: { ctx: ClientAppContext; db: SupabaseClient }) {
  const [{ data: p }, forms] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select("first_name, last_name, email, mobile_phone, treatment_consent_signed_at")
      .eq("id", ctx.userId)
      .maybeSingle<Patient>(),
    loadPendingForms(db, ctx.userId),
  ]);
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
  const canMessage = ctx.tabs.some((t) => t.key === "messages");

  return (
    <ClientShell ctx={ctx} active="me" title="Me" lead="Your details, your consent, and anything waiting for you.">
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
