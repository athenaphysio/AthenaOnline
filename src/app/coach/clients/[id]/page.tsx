import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/coachAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { clientAccessFor, logAccess } from "@/lib/clinicianAccess";
import { PASSPORT_SECTIONS, sectionLabel } from "@/lib/clinicianAccessSections";
import { loadClinicPassport, buildSummaries, type DomainSummary } from "@/lib/passportServer";
import { resolveBrandPack } from "@/lib/brandPackResolve";
import { STATUS_STYLE, TREND_WORDS, formatValue, timepointLabel } from "@/lib/passport";
import { Sparkline, shortDate } from "@/components/passport/PassportCharts";
import styles from "../../../clinic/clinic.module.css";
import LogoutButton from "../../LogoutButton";
import CoachNoteForm from "./CoachNoteForm";

export const dynamic = "force-dynamic";

// One client, as a clinician sees them: only the sections this clinician is
// switched on for AND the client agreed to. Every opening is logged.
export default async function CoachClientPage({ params }: { params: Promise<{ id: string }> }) {
  const coach = await requireCoach();
  const { id } = await params;
  const access = await clientAccessFor(coach.id, id);
  if (!access) notFound();

  const can = (s: string) => access.sections.includes(s as never);
  const visibleSections = access.sections.filter((s) => s !== "write_notes");
  await logAccess(coach.id, id, visibleSections);

  const passportDomains = PASSPORT_SECTIONS.filter((d) => can(d));

  const [brand, details, programme, passport, notes] = await Promise.all([
    resolveBrandPack({ patientId: id }).catch(() => null),
    can("details")
      ? supabaseAdmin
          .from("patients")
          .select("email, date_of_birth, occupation, sport")
          .eq("id", id)
          .maybeSingle<{ email: string; date_of_birth: string | null; occupation: string | null; sport: string | null }>()
          .then((r) => r.data)
      : Promise.resolve(null),
    can("programme") ? loadProgramme(id) : Promise.resolve(null),
    passportDomains.length > 0 ? loadClinicPassport(id) : Promise.resolve(null),
    supabaseAdmin
      .from("care_notes")
      .select("id, section, author_name, body, created_at")
      .eq("patient_id", id)
      .in("section", visibleSections)
      .order("created_at", { ascending: false })
      .returns<{ id: string; section: string; author_name: string; body: string; created_at: string }[]>()
      .then((r) => r.data ?? []),
  ]);

  const domains: DomainSummary[] = passport
    ? buildSummaries(passport.markers, passport.results).filter((d) => passportDomains.includes(d.key as never))
    : [];
  const name = [access.firstName, access.lastName].filter(Boolean).join(" ");
  const accent = brand && !brand.isAllDefault ? brand.accent_color : "var(--crimson)";

  return (
    <div className={styles.app}>
      <div className={styles.inner} style={{ maxWidth: 980 }}>
        <div className={styles.brandbar}>
          <span className={styles.brandmark}>
            {brand?.logo_mark_url && !brand.isAllDefault ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_mark_url} alt="" width={22} height={22} />
            ) : (
              <Image src="/icons/athena-mark.png" alt="" width={22} height={22} />
            )}
          </span>
          <div className={styles.brandname}>{access.packageName}, clinician area</div>
          <div style={{ marginLeft: "auto" }}>
            <LogoutButton />
          </div>
        </div>

        <Link href="/coach" className={styles.canvasLink}>
          ‹ All clients
        </Link>
        <h1 className={styles.heading} style={{ marginTop: 10, borderLeft: `4px solid ${accent}`, paddingLeft: 12 }}>
          {name}
        </h1>
        <p className={styles.subheading}>
          You can see: {visibleSections.map(sectionLabel).join(", ")}. This visit is recorded.
        </p>

        {details && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>Personal details</div>
            <Detail label="Email" value={details.email} />
            <Detail label="Date of birth" value={details.date_of_birth ? shortDate(details.date_of_birth) : null} />
            <Detail label="Occupation" value={details.occupation} />
            <Detail label="Sport" value={details.sport} />
          </div>
        )}

        {programme && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>Programme and progress</div>
            {programme.programmes.length === 0 && <p className={styles.notice} style={{ marginTop: 0 }}>No programme assigned at the moment.</p>}
            {programme.programmes.map((p) => (
              <div key={p.id} style={{ padding: "8px 0", borderTop: "1px solid var(--mist)" }}>
                <div style={{ fontWeight: 600 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: "var(--graphite)" }}>
                  {p.delivery_mode === "open" ? "Open routine" : `${p.block_length_weeks} week block`}
                  {p.start_date && `, started ${shortDate(p.start_date)}`}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 13.5, marginTop: 10 }}>
              {programme.completed} practice{programme.completed === 1 ? "" : "s"} completed
              {programme.lastAt && `, most recently ${shortDate(programme.lastAt.slice(0, 10))}`}.
            </div>
          </div>
        )}

        {domains.map((d) => (
          <div key={d.key} className={styles.card} style={{ borderLeft: `4px solid ${d.colour}` }}>
            <div className={styles.cardTitle}>{d.name}</div>
            {d.series.length === 0 && <p className={styles.notice} style={{ marginTop: 0 }}>No results yet.</p>}
            {d.series.map((s) => {
              const st = STATUS_STYLE[s.status];
              return (
                <div key={s.marker.marker_key} style={{ padding: "10px 0", borderTop: "1px solid var(--mist)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {s.marker.name}
                        {s.marker.panel && <span style={{ fontWeight: 400, color: "var(--graphite)" }}> · {s.marker.panel}</span>}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--graphite)" }}>{TREND_WORDS[s.trend]}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Sparkline values={s.results.map((r) => Number(r.value))} colour={d.colour} />
                      <span style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, color: st.colour, background: st.soft }}>{st.label}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, marginTop: 6 }}>
                    {s.results.map((r) => (
                      <span key={r.id} style={{ fontVariantNumeric: "tabular-nums" }}>
                        <span style={{ color: "var(--graphite)" }}>{timepointLabel(r.timepoint)}:</span>{" "}
                        <strong>{formatValue(Number(r.value))}</strong> {s.marker.unit}
                        {r.status === "draft" && <span style={{ color: "var(--amber)" }}> (draft, not yet shown to the client)</span>}
                      </span>
                    ))}
                  </div>
                  {s.latest.clinician_note && (
                    <div style={{ fontSize: 13, marginTop: 6, color: "var(--stone)" }}>Note to client: {s.latest.clinician_note}</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div className={styles.card}>
          <div className={styles.cardTitle}>Care team notes</div>
          {can("write_notes") && <CoachNoteForm patientId={id} sections={visibleSections.map((s) => ({ key: s, label: sectionLabel(s) }))} />}
          {notes.length === 0 && <p className={styles.notice}>No notes yet.</p>}
          {notes.map((n) => (
            <div key={n.id} style={{ borderTop: "1px solid var(--mist)", padding: "10px 0", marginTop: 8 }}>
              <div style={{ fontSize: 12.5, color: "var(--graphite)" }}>
                {n.author_name}, {sectionLabel(n.section)}, {new Date(n.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </div>
              <div style={{ fontSize: 14, whiteSpace: "pre-wrap", marginTop: 2 }}>{n.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "4px 0", fontSize: 14 }}>
      <span style={{ width: 120, color: "var(--graphite)" }}>{label}</span>
      <span>{value || "Not recorded"}</span>
    </div>
  );
}

async function loadProgramme(patientId: string) {
  const [{ data: programmes }, { data: completions }] = await Promise.all([
    supabaseAdmin
      .from("programmes")
      .select("id, title, start_date, block_length_weeks, delivery_mode")
      .eq("patient_id", patientId)
      .is("access_paused_at", null)
      .order("created_at", { ascending: false })
      .returns<{ id: string; title: string; start_date: string | null; block_length_weeks: number; delivery_mode: string }[]>(),
    supabaseAdmin
      .from("session_completions")
      .select("occurred_at")
      .eq("patient_id", patientId)
      .eq("status", "completed")
      .order("occurred_at", { ascending: false })
      .returns<{ occurred_at: string }[]>(),
  ]);
  return { programmes: programmes ?? [], completed: (completions ?? []).length, lastAt: completions?.[0]?.occurred_at ?? null };
}
