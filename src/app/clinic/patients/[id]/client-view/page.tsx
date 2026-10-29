import Link from "next/link";
import ClientRecordShell from "../ClientRecordShell";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClientHome from "@/app/session/ClientHome";
import { loadClientPassport } from "@/lib/passportServer";
import { PassportSummary } from "@/components/passport/PassportViews";
import PassportShell from "@/app/session/passport/PassportShell";
import ProgrammeScreen from "@/app/session/screens/ProgrammeScreen";
import MessagesScreen from "@/app/session/screens/MessagesScreen";
import MeScreen from "@/app/session/screens/MeScreen";
import TeamScreen from "@/app/session/screens/TeamScreen";
import { loadClientApp } from "@/lib/clientApp";
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
  const passportOn = patient.passport_enabled === true;
  const ctx = await loadClientApp(id);
  // The same tabs the client has. Without a toolbar on their pack, Home and
  // My Passport as before.
  const screens = ctx.layout.bottom_bar
    ? ctx.tabs.map((t) => ({ key: t.key, label: t.label }))
    : [
        { key: "home" as const, label: "Home" },
        { key: "passport" as const, label: "My Passport" },
      ];
  const showing = screens.find((s) => s.key === tab && (s.key !== "passport" || passportOn))?.key ?? "home";
  const domains = showing === "passport" ? await loadClientPassport(supabaseAdmin, id) : null;

  return (
    <ClientRecordShell patientId={id} active="client-view">
    <div className={styles.page}>
      <div className={styles.top}>
        <h2 className={styles.title}>What {patient.first_name || "they"} see{patient.first_name ? "s" : ""}</h2>
        <p className={styles.lead}>
          Exactly what {patient.first_name || "this client"} sees on their phone right now, drawn from their real
          programme, progress and branding. This is a view only mirror: nothing here can be tapped, and looking at it
          does not count as the client being active.
        </p>
        <nav className={styles.tabs} aria-label="Which screen">
          {screens.map((sc) =>
            sc.key === "passport" && !passportOn ? (
              <span key={sc.key} className={styles.tabOff} title="Switch the passport on for this client to see it here">
                {sc.label} (off)
              </span>
            ) : (
              <Link
                key={sc.key}
                href={sc.key === "home" ? `/clinic/patients/${id}/client-view` : `/clinic/patients/${id}/client-view?tab=${sc.key}`}
                className={`${styles.tab} ${showing === sc.key ? styles.tabOn : ""}`}
              >
                {sc.label}
              </Link>
            ),
          )}
          {ctx.layout.bottom_bar && !passportOn && ctx.layout.tabs.passport && (
            <span className={styles.tabOff} title="Switch the passport on for this client to see it here">
              Passport (off)
            </span>
          )}
        </nav>
      </div>

      <div className={styles.phone}>
        <div className={styles.notch} aria-hidden="true" />
        <div className={styles.screen}>
          <div className={styles.scroller}>
            <div className={styles.readOnly} inert>
              {showing === "home" && <ClientHome db={supabaseAdmin} userId={id} firstName={firstName} preview />}
              {showing === "passport" && (
                <PassportShell ctx={ctx}>
                  <PassportSummary domains={domains ?? []} />
                </PassportShell>
              )}
              {showing === "programme" && <ProgrammeScreen ctx={ctx} />}
              {showing === "messages" && <MessagesScreen ctx={ctx} preview />}
              {showing === "me" && <MeScreen ctx={ctx} db={supabaseAdmin} />}
              {showing === "team" && <TeamScreen ctx={ctx} />}
            </div>
          </div>
        </div>
      </div>
    </div>
    </ClientRecordShell>
  );
}
