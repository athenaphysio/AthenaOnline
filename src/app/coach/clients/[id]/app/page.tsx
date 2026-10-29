import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCoachClient } from "@/lib/coachClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadClientApp } from "@/lib/clientApp";
import { loadClientPassport } from "@/lib/passportServer";
import { PassportSummary } from "@/components/passport/PassportViews";
import { PASSPORT_SECTIONS } from "@/lib/clinicianAccessSections";
import ClientHome from "@/app/session/ClientHome";
import PassportShell from "@/app/session/passport/PassportShell";
import ProgrammeScreen from "@/app/session/screens/ProgrammeScreen";
import MeScreen from "@/app/session/screens/MeScreen";
import TeamScreen from "@/app/session/screens/TeamScreen";
import CoachClientShell from "../CoachClientShell";
import styles from "../../../../clinic/patients/[id]/client-view/ClientView.module.css";

export const dynamic = "force-dynamic";

// A read only mirror of the client's phone, drawn by the same code as their
// app. Only the screens this clinician may see: never their messages, the
// passport only with every passport area shared, and their details only
// with personal details shared.
export default async function CoachClientApp({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const ctx = await loadCoachClient(id);
  if (!ctx.can("programme")) notFound();
  const app = await loadClientApp(id);
  const allPassport = PASSPORT_SECTIONS.every((s) => ctx.can(s));
  const screens = [
    { key: "home", label: "Home" },
    ...(app.tabs.some((t) => t.key === "programme") ? [{ key: "programme", label: "Programme" }] : []),
    ...(allPassport && app.passportEnabled ? [{ key: "passport", label: "Passport" }] : []),
    ...(ctx.can("details") && app.tabs.some((t) => t.key === "me") ? [{ key: "me", label: "Me" }] : []),
    ...(app.tabs.some((t) => t.key === "team") ? [{ key: "team", label: "Team" }] : []),
  ];
  const showing = screens.find((s) => s.key === tab)?.key ?? "home";
  await ctx.record(["programme", ...(showing === "passport" ? PASSPORT_SECTIONS : []), ...(showing === "me" ? ["details"] : [])]);

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(id).catch(() => ({ data: { user: null } }));
  const firstName = (authUser?.user?.user_metadata?.first_name as string | undefined) || ctx.access.firstName || "there";
  const domains = showing === "passport" ? await loadClientPassport(supabaseAdmin, id) : null;
  const base = `/coach/clients/${id}/app`;

  return (
    <CoachClientShell ctx={ctx} active="app">
      <div className={styles.page}>
        <div className={styles.top}>
          <h2 className={styles.title}>What {ctx.access.firstName} sees</h2>
          <p className={styles.lead}>
            Exactly what {ctx.access.firstName} sees on their phone, drawn from their real programme and branding. Nothing here can be tapped, and
            looking at it does not count as the client being active.
          </p>
          <nav className={styles.tabs} aria-label="Which screen">
            {screens.map((s) => (
              <Link key={s.key} href={s.key === "home" ? base : `${base}?tab=${s.key}`} className={`${styles.tab} ${showing === s.key ? styles.tabOn : ""}`}>
                {s.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className={styles.phone}>
          <div className={styles.notch} aria-hidden="true" />
          <div className={styles.screen}>
            <div className={styles.scroller}>
              <div className={styles.readOnly} inert>
                {showing === "home" && <ClientHome db={supabaseAdmin} userId={id} firstName={firstName} preview />}
                {showing === "programme" && <ProgrammeScreen ctx={app} />}
                {showing === "passport" && (
                  <PassportShell ctx={app}>
                    <PassportSummary domains={domains ?? []} />
                  </PassportShell>
                )}
                {showing === "me" && <MeScreen ctx={app} db={supabaseAdmin} />}
                {showing === "team" && <TeamScreen ctx={app} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CoachClientShell>
  );
}
