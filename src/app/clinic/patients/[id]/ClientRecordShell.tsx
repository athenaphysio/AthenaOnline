import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBrandPackCatalog } from "@/lib/brandPack";
import { resolveBrandPack } from "@/lib/brandPackResolve";
import { dashboardBrand } from "@/lib/clinicianBrandStyle";
import ClinicBrandbar from "../../ClinicBrandbar";
import styles from "./dashboard/ClientDashboard.module.css";
import BrandingButton, { type BrandOption } from "./dashboard/BrandingButton";
import EditDetailsButton from "./dashboard/EditDetailsButton";
import { photoLink } from "@/lib/clientPhoto";

export type RecordTab = "overview" | "background" | "programme" | "sessions" | "forms" | "messages" | "passport" | "client-view";

type ShellPatient = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  date_of_birth: string | null;
  occupation: string | null;
  sport: string | null;
  assigned_clinician: string | null;
  clinic_location: string | null;
  photo_path: string | null;
};

// Every page of a client's record sits inside this: the client's branding,
// their name, and one tab bar, so moving between Overview, Client
// background, Sessions and the rest feels like one record.
export default async function ClientRecordShell({
  patientId,
  active,
  belowName,
  children,
}: {
  patientId: string;
  active: RecordTab | null;
  belowName?: ReactNode;
  children: ReactNode;
}) {
  const [{ data: patient }, brandPacks, { data: programmes }, brand] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select("id, first_name, last_name, email, date_of_birth, occupation, sport, assigned_clinician, clinic_location, brand_pack_id, photo_path")
      .eq("id", patientId)
      .maybeSingle<ShellPatient & { brand_pack_id: string | null }>(),
    getBrandPackCatalog().catch(() => []),
    supabaseAdmin
      .from("programmes")
      .select("id, delivery_mode")
      .eq("patient_id", patientId)
      .is("access_paused_at", null)
      .order("created_at", { ascending: false })
      .returns<{ id: string; delivery_mode: string }[]>(),
    resolveBrandPack({ patientId }).catch(() => null),
  ]);
  if (!patient) notFound();

  const branded = dashboardBrand(brand);
  const current = programmes?.find((p) => p.delivery_mode === "scheduled") ?? programmes?.[0] ?? null;
  const base = `/clinic/patients/${patientId}`;
  const initials = `${patient.first_name?.[0] ?? ""}${patient.last_name?.[0] ?? ""}`.toUpperCase() || "?";
  const photoUrl = await photoLink(patient.photo_path);

  const tabs: { key: RecordTab; label: string; href: string; icon: ReactNode; featured?: boolean }[] = [
    { key: "overview", label: "Overview", href: `${base}/dashboard`, icon: <Icon d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" /> },
    { key: "background", label: "Client profile", href: `${base}/background`, featured: true, icon: <Icon d="M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5" /> },
    {
      key: "programme",
      label: "Programme",
      href: current ? `/clinic/programmes/${current.id}` : `/clinic/programmes/new?patient=${patientId}`,
      icon: <Icon d="M5 6h14M5 12h14M5 18h9" />,
    },
    { key: "sessions", label: "Sessions", href: `${base}/sessions`, icon: <Icon d="M5 6h14v14H5zM5 10h14M9 3v4M15 3v4" /> },
    { key: "forms", label: "Forms", href: `${base}/forms`, icon: <Icon d="M7 4h10v16H7zM10 9l1.5 1.5L14 8M10 15h4" /> },
    { key: "messages", label: "Messages", href: `${base}/messages`, icon: <Icon d="M4 6h16v10H9l-5 4z" /> },
    { key: "passport", label: "Passport", href: `${base}/passport`, icon: <Icon d="M6 4h12v16H6zM9 15l2-3 2 2 2-4" /> },
    { key: "client-view", label: "Client view", href: `${base}/client-view`, icon: <Icon d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2" /> },
  ];

  return (
    <div className={`${styles.page} ${branded.light ? styles.pageLight : ""}`} style={branded.style}>
      <div className={styles.wrap}>
        <ClinicBrandbar logoUrl={branded.logoUrl} wordmarkUrl={branded.wordmarkUrl} />

        <div className={styles.topbar} style={{ marginBottom: 18 }}>
          <div className={styles.nameBlock}>
            <div
              className={styles.avatar}
              style={
                photoUrl
                  ? { overflow: "hidden", padding: 0 }
                  : branded.style
                    ? // A branded client's initials sit on their pack's own accent.
                      { background: "linear-gradient(145deg, var(--crimson), color-mix(in srgb, var(--crimson) 55%, #000))", color: "#fff" }
                    : undefined
              }
            >
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt={`Photo of ${patient.first_name}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                initials
              )}
            </div>
            <div>
              <h1>
                {patient.first_name}
                {patient.last_name ? ` ${patient.last_name}` : ""}
              </h1>
              <div className={styles.muted} style={{ fontSize: 13, marginTop: 4 }}>
                {patient.email}
              </div>
              {belowName}
            </div>
          </div>
        </div>

        <nav className={styles.recordNav} aria-label="Client record">
          <div className={styles.recordTabs}>
            {tabs.map((t) => (
              <a
                key={t.key}
                href={t.href}
                className={`${styles.recordTab} ${t.featured ? styles.recordTabFeatured : ""} ${active === t.key ? styles.recordTabActive : ""}`}
                aria-current={active === t.key ? "page" : undefined}
              >
                {t.icon}
                {t.label}
              </a>
            ))}
          </div>
          <div className={styles.recordActions}>
            <a href={`${base}/care-team`} className={`${styles.btn} ${styles.btnGhost}`}>
              Care team
            </a>
            <BrandingButton
              patientId={patient.id}
              currentId={patient.brand_pack_id}
              packs={brandPacks.map(
                (b): BrandOption => ({
                  id: b.id,
                  name: b.name,
                  is_default: b.is_default,
                  accent_color: b.accent_color,
                  background_color: b.background_color,
                  logo_mark_url: b.logo_mark_url,
                })
              )}
            />
            <EditDetailsButton
              patientId={patient.id}
              initial={{
                first_name: patient.first_name,
                last_name: patient.last_name,
                email: patient.email,
                date_of_birth: patient.date_of_birth,
                occupation: patient.occupation,
                sport: patient.sport,
                assigned_clinician: patient.assigned_clinician,
                clinic_location: patient.clinic_location,
              }}
            />
          </div>
        </nav>

        {children}
      </div>
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
