import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClientHome from "@/app/session/ClientHome";
import { loadClientPassport } from "@/lib/passportServer";
import { PassportSummary } from "@/components/passport/PassportViews";
import PassportTabBar from "@/components/passport/PassportTabBar";
import sessionStyles from "@/app/session/TodaySession.module.css";
import styles from "./ClientView.module.css";

export const dynamic = "force-dynamic";

// A mirror of the client's phone. It is drawn by the very same code as the
// client's own app, from their real data, but read only: nothing on it can
// be tapped, and opening it records nothing against the client.
export default async function ClientViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("first_name, last_name, passport_enabled")
    .eq("id", id)
    .maybeSingle<{ first_name: string | null; last_name: string | null; passport_enabled: boolean | null }>();
  if (!patient) notFound();

  // The app greets the client by the first name on their login, so the
  // mirror uses the same, falling back to the client record.
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(id).catch(() => ({ data: { user: null } }));
  const firstName = (authUser?.user?.user_metadata?.first_name as string | undefined) || patient.first_name || "there";
  const name = [patient.first_name, patient.last_name].filter(Boolean).join(" ") || "This client";
  const passportOn = patient.passport_enabled === true;
  const showing = tab === "passport" && passportOn ? "passport" : "home";
  const domains = showing === "passport" ? await loadClientPassport(supabaseAdmin, id) : null;

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <Link href={`/clinic/patients/${id}/dashboard`} className={styles.back}>
          ‹ Back to {name}
        </Link>
        <h1 className={styles.title}>Client view</h1>
        <p className={styles.lead}>
          Exactly what {patient.first_name || "this client"} sees on their phone right now, drawn from their real
          programme, progress and branding. This is a view only mirror: nothing here can be tapped, and looking at it
          does not count as the client being active.
        </p>
        <nav className={styles.tabs} aria-label="Which screen">
          <Link href={`/clinic/patients/${id}/client-view`} className={`${styles.tab} ${showing === "home" ? styles.tabOn : ""}`}>
            Home
          </Link>
          {passportOn ? (
            <Link
              href={`/clinic/patients/${id}/client-view?tab=passport`}
              className={`${styles.tab} ${showing === "passport" ? styles.tabOn : ""}`}
            >
              My Passport
            </Link>
          ) : (
            <span className={styles.tabOff} title="Switch the passport on for this client to see it here">
              My Passport (off)
            </span>
          )}
        </nav>
      </div>

      <div className={styles.phone}>
        <div className={styles.notch} aria-hidden="true" />
        <div className={styles.screen}>
          <div className={styles.scroller}>
            <div className={styles.readOnly} inert>
              {showing === "home" ? (
                <ClientHome db={supabaseAdmin} userId={id} firstName={firstName} preview />
              ) : (
                <div className={sessionStyles.app}>
                  <div className={sessionStyles.inner}>
                    <PassportSummary domains={domains ?? []} />
                  </div>
                  <PassportTabBar active="passport" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
