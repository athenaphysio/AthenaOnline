import type { ReactNode } from "react";
import Link from "next/link";
import { dashboardBrand } from "@/lib/clinicianBrandStyle";
import { photoLink } from "@/lib/clientPhoto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sectionLabel } from "@/lib/clinicianAccessSections";
import type { CoachClientContext } from "@/lib/coachClient";
import styles from "../../../clinic/patients/[id]/dashboard/ClientDashboard.module.css";
import clinicStyles from "../../../clinic/clinic.module.css";
import LogoutButton from "../../LogoutButton";

export type CoachTab = "profile" | "passport" | "programme" | "app" | "notes";

// The frame around every page a clinician sees about one client: the
// client's own brand (and nothing of Athena's when they have one), their
// name and photo, what this clinician may see, and the tabs. It mirrors the
// clinic's own client record, read only.
export default async function CoachClientShell({ ctx, active, children }: { ctx: CoachClientContext; active: CoachTab; children: ReactNode }) {
  const branded = dashboardBrand(ctx.brand);
  const base = `/coach/clients/${ctx.patientId}`;
  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("photo_path")
    .eq("id", ctx.patientId)
    .maybeSingle<{ photo_path: string | null }>();
  const photoUrl = await photoLink(patient?.photo_path);
  const name = [ctx.access.firstName, ctx.access.lastName].filter(Boolean).join(" ");
  const initials = `${ctx.access.firstName?.[0] ?? ""}${ctx.access.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const visible = ctx.access.sections.filter((s) => s !== "write_notes");

  const tabs: { key: CoachTab; label: string; href: string; icon: string; featured?: boolean; show: boolean }[] = [
    { key: "profile", label: "Client profile", href: base, featured: true, icon: "M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5", show: true },
    { key: "passport", label: "Passport", href: `${base}/passport`, icon: "M6 4h12v16H6zM9 15l2-3 2 2 2-4", show: ctx.passportDomains.length > 0 },
    { key: "programme", label: "Programme", href: `${base}/programme`, icon: "M5 6h14M5 12h14M5 18h9", show: ctx.can("programme") },
    { key: "app", label: "Client view", href: `${base}/app`, icon: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2", show: ctx.can("programme") },
    { key: "notes", label: "Care team notes", href: `${base}/notes`, icon: "M4 6h16v10H9l-5 4z", show: true },
  ];

  return (
    <div className={`${styles.page} ${branded.light ? styles.pageLight : ""}`} style={branded.style}>
      <div className={styles.wrap}>
        <div className={clinicStyles.brandbar} style={{ cursor: "default" }}>
          <Link href="/coach" aria-label="All clients" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
            {branded.wordmarkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branded.wordmarkUrl} alt={ctx.access.packageName} style={{ height: 30, width: "auto", maxWidth: 220, objectFit: "contain" }} />
            ) : (
              <span className={clinicStyles.brandname}>{ctx.access.packageName}</span>
            )}
          </Link>
          <div style={{ marginLeft: "auto" }}>
            <LogoutButton />
          </div>
        </div>

        <Link href="/coach" className={clinicStyles.canvasLink} style={{ display: "inline-block", marginBottom: 12 }}>
          ‹ All clients
        </Link>

        <div className={styles.topbar} style={{ marginBottom: 18 }}>
          <div className={styles.nameBlock}>
            <div
              className={styles.avatar}
              style={
                photoUrl
                  ? { overflow: "hidden", padding: 0 }
                  : { background: "linear-gradient(145deg, var(--crimson), color-mix(in srgb, var(--crimson) 55%, #000))", color: "#fff" }
              }
            >
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt={`Photo of ${name}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                initials
              )}
            </div>
            <div>
              <h1>{name}</h1>
              <div className={styles.muted} style={{ fontSize: 13, marginTop: 4, maxWidth: 640, lineHeight: 1.5 }}>
                {ctx.access.packageName}. You can see {visible.map((s) => sectionLabel(s).toLowerCase()).join(", ")}. Each visit is recorded.
              </div>
            </div>
          </div>
        </div>

        <nav className={styles.recordNav} aria-label="Client record">
          <div className={styles.recordTabs}>
            {tabs
              .filter((t) => t.show)
              .map((t) => (
                <a
                  key={t.key}
                  href={t.href}
                  className={`${styles.recordTab} ${t.featured ? styles.recordTabFeatured : ""} ${active === t.key ? styles.recordTabActive : ""}`}
                  aria-current={active === t.key ? "page" : undefined}
                >
                  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                    <path d={t.icon} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t.label}
                </a>
              ))}
          </div>
        </nav>

        {children}
      </div>
    </div>
  );
}

// Shown in place of a part of the record this clinician cannot see.
export function NotShared({ what }: { what: string }) {
  return (
    <div className={styles.card} style={{ padding: 18 }}>
      <p className={styles.muted} style={{ margin: 0, fontSize: 14 }}>
        {what} is not shared with you for this client. If you need it, ask Dr David Silver PhD, and the client will be asked to agree.
      </p>
    </div>
  );
}
