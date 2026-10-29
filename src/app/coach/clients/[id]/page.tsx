import { loadCoachClient } from "@/lib/coachClient";
import { listContextEntries, listPhysicalEntries } from "@/lib/clientBackground";
import { countArms } from "@/lib/backgroundSummary";
import { loadClinicPassport, buildSummaries } from "@/lib/passportServer";
import { PERSON_ARMS, PHYSICAL_SECTIONS, type BackgroundPart } from "@/lib/personMap";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import PersonMap from "../../../clinic/patients/[id]/background/PersonMap";
import CoachClientShell, { NotShared } from "./CoachClientShell";
import DomainCards from "./DomainCards";
import styles from "../../../clinic/patients/[id]/dashboard/ClientDashboard.module.css";

export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// Client profile, as a clinician sees it: the same triangle as the clinic,
// with each part shown read only, and only where this clinician may see it.
export default async function CoachClientProfile({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ part?: string }>;
}) {
  const { id } = await params;
  const { part: rawPart } = await searchParams;
  const ctx = await loadCoachClient(id);
  const part: BackgroundPart = PERSON_ARMS.some((a) => a.key === rawPart) ? (rawPart as BackgroundPart) : "person";
  const arm = PERSON_ARMS.find((a) => a.key === part);
  const base = `/coach/clients/${id}`;
  const arms = await countArms(id);

  let body: React.ReactNode;
  if (part === "person") {
    body = await PersonPart({ id, canDetails: ctx.can("details"), canContext: ctx.can("context") });
    await ctx.record(["details", "context"]);
  } else {
    const domainsHere = (arm?.domains ?? []).filter((d) => ctx.passportDomains.includes(d));
    const passport = domainsHere.length ? await loadClinicPassport(id) : null;
    const domains = passport ? buildSummaries(passport.markers, passport.results).filter((d) => domainsHere.includes(d.key)) : [];
    const physical = part === "physicality" && ctx.can("physical") ? await listPhysicalEntries(id) : null;
    await ctx.record([...domainsHere, ...(physical ? ["physical"] : [])]);
    body = (
      <div style={{ display: "grid", gap: 16 }}>
        {part === "physicality" &&
          (physical ? (
            PHYSICAL_SECTIONS.map((sec) => {
              const items = physical.filter((e) => e.section === sec.key);
              return (
                <div key={sec.key} className={styles.card} style={{ padding: 18 }}>
                  <h3 style={{ margin: "0 0 6px" }}>{sec.label}</h3>
                  {items.length === 0 && <p className={styles.muted} style={{ margin: 0, fontSize: 14 }}>Nothing recorded yet.</p>}
                  {items.map((e) => (
                    <div key={e.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
                      <div style={{ fontWeight: 600 }}>{e.title || sec.label}</div>
                      <div className={styles.muted} style={{ fontSize: 12.5, marginBottom: 6 }}>{fmt(e.dated)}</div>
                      {e.body && <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6 }}>{e.body}</div>}
                    </div>
                  ))}
                </div>
              );
            })
          ) : (
            <NotShared what="Physical capacity notes" />
          ))}
        {domains.length > 0 ? <DomainCards domains={domains} /> : domainsHere.length === 0 && <NotShared what={`${arm?.label ?? "This"} passport data`} />}
      </div>
    );
  }

  return (
    <CoachClientShell ctx={ctx} active="profile">
      <div style={{ margin: "-6px 0 6px" }}>
        <PersonMap base={base} active={part} arms={arms} />
      </div>
      <div style={{ margin: "10px 0 14px" }}>
        <h2 style={{ margin: 0, fontSize: 30 }}>{arm ? arm.label : "Client context"}</h2>
        <p className={styles.muted} style={{ margin: "4px 0 0", fontSize: 14 }}>
          {arm ? `${arm.source}: ${arm.detail}.` : "The Client context summary from the consultation, with the full background notes behind it."}
        </p>
      </div>
      {body}
    </CoachClientShell>
  );
}

async function PersonPart({ id, canDetails, canContext }: { id: string; canDetails: boolean; canContext: boolean }) {
  const [entries, details] = await Promise.all([
    canContext ? listContextEntries(id) : Promise.resolve([]),
    canDetails
      ? supabaseAdmin
          .from("patients")
          .select("email, date_of_birth, occupation, sport")
          .eq("id", id)
          .maybeSingle<{ email: string; date_of_birth: string | null; occupation: string | null; sport: string | null }>()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);
  const latest = entries[0];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {canContext ? (
        <div className={styles.card} style={{ padding: 20 }}>
          <h3 style={{ margin: 0 }}>Client context summary</h3>
          {latest ? (
            <>
              <div className={styles.muted} style={{ fontSize: 12.5, margin: "4px 0 10px" }}>
                From the consultation on {fmt(latest.consulted_on)}
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.65 }}>{latest.summary_text || "No summary written yet."}</div>
              {latest.notes_text && (
                <details style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>Client context, the full background notes</summary>
                  <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>{latest.notes_text}</div>
                </details>
              )}
            </>
          ) : (
            <p className={styles.muted} style={{ margin: "8px 0 0", fontSize: 14 }}>No consultation recorded yet.</p>
          )}
        </div>
      ) : (
        <NotShared what="The client context" />
      )}
      {details && (
        <div className={styles.card} style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 8px" }}>Personal details</h3>
          {[
            ["Email", details.email],
            ["Date of birth", details.date_of_birth ? fmt(details.date_of_birth) : null],
            ["Occupation", details.occupation],
            ["Sport", details.sport],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 12, padding: "4px 0", fontSize: 14 }}>
              <span className={styles.muted} style={{ width: 120 }}>{k}</span>
              <span>{v || "Not recorded"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
