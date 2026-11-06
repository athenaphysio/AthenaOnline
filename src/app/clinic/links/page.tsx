import Link from "next/link";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";
import { getBrandPackCatalog } from "@/lib/brandPack";
import { linkSlug, normaliseAppLayout } from "@/lib/appLayout";
import ClientLinksList from "../vault/brand-packs/ClientLinksList";

export const dynamic = "force-dynamic";

// Every link Dr David Silver PhD sends clients, for every brand pack, in one
// place: app login, registration, registration followed by the Programme
// intake form, and the intake form on its own. Each is the same link shown
// on that pack's own page.
export default async function ClientLinksPage() {
  const packs = await getBrandPackCatalog();

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Client links</h1>
        <p className={styles.subheading}>
          The links to send clients by WhatsApp or email, in each brand&apos;s own look. Open a brand, then copy the link
          or a ready written message. Link names are set on each{" "}
          <Link href="/clinic/vault/brand-packs" className={styles.canvasLink}>
            brand pack
          </Link>
          .
        </p>

        {packs.map((p, i) => {
          const slug = p.is_default ? null : linkSlug(normaliseAppLayout(p.app_layout).link_name) || linkSlug(p.name);
          return (
            <details key={p.id} className={styles.card} open={i === 0}>
              <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 500 }}>
                {p.name}
                {p.is_default ? " (standard)" : ""}
              </summary>
              <div style={{ marginTop: 12 }}>
                <ClientLinksList slug={slug} />
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
