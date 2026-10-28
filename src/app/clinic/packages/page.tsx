import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";
import PackagesManager, { type PackageRow } from "./PackagesManager";
import { DEFAULT_CONSENT_DRAFT } from "@/lib/consentDraft";

export const dynamic = "force-dynamic";

// Packages group clients for a partner or programme, such as Regenerate or
// Atomic SpeedWorks. Each has its own branding and its own consent wording.
export default async function PackagesPage() {
  const [{ data: packages }, { data: packs }, { data: members }, { data: versions }, { data: consents }] = await Promise.all([
    supabaseAdmin.from("packages").select("id, name, brand_pack_id").order("name").returns<{ id: string; name: string; brand_pack_id: string | null }[]>(),
    supabaseAdmin.from("brand_packs").select("id, name").order("name").returns<{ id: string; name: string }[]>(),
    supabaseAdmin.from("patient_packages").select("package_id").returns<{ package_id: string }[]>(),
    supabaseAdmin
      .from("consent_versions")
      .select("package_id, version, body, published_at")
      .order("version", { ascending: false })
      .returns<{ package_id: string; version: number; body: string; published_at: string | null }[]>(),
    supabaseAdmin
      .from("patient_consents")
      .select("patient_id, package_id, withdrawn_at, signed_at")
      .order("signed_at", { ascending: false })
      .returns<{ patient_id: string; package_id: string; withdrawn_at: string | null; signed_at: string }[]>(),
  ]);

  const rows: PackageRow[] = (packages ?? []).map((p) => {
    const own = (versions ?? []).filter((v) => v.package_id === p.id);
    const latest = own[0] ?? null;
    const published = own.find((v) => v.published_at) ?? null;
    const seen = new Set<string>();
    let signed = 0;
    for (const c of consents ?? []) {
      if (c.package_id !== p.id || seen.has(c.patient_id)) continue;
      seen.add(c.patient_id);
      if (!c.withdrawn_at) signed++;
    }
    return {
      id: p.id,
      name: p.name,
      brandPackId: p.brand_pack_id,
      clientCount: (members ?? []).filter((m) => m.package_id === p.id).length,
      signedCount: signed,
      publishedVersion: published ? { version: published.version, publishedAt: published.published_at! } : null,
      draftBody: latest && !latest.published_at ? latest.body : published?.body ?? DEFAULT_CONSENT_DRAFT,
      hasUnpublishedDraft: Boolean(latest && !latest.published_at),
    };
  });

  return (
    <div className={styles.app}>
      <div className={styles.inner} style={{ maxWidth: 1000 }}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>Packages</h1>
        <p className={styles.subheading}>
          A package groups clients for a partner, such as Regenerate. Each package has its own branding and its own
          consent wording. Put clients into a package from their dashboard, and choose what each clinician sees on the
          Staff page.
        </p>
        <PackagesManager packages={rows} brandPacks={packs ?? []} />
      </div>
    </div>
  );
}
