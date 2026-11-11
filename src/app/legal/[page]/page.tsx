import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import PageBanner from "@/components/PageBanner";
import BrandLinkHeader from "@/components/BrandLinkHeader";
import { loginPageBrand } from "@/lib/loginBrand";
import { metadataForBrand, viewportForBrand } from "@/lib/brandMetadata";
import { brandScopeStyle } from "@/app/session/brandScopeStyle";
import { LEGAL_TITLES, isRegenerateBrand, legalDoc, type LegalBlock, type LegalPage } from "@/lib/legalDocs";
import styles from "../Legal.module.css";

export const dynamic = "force-dynamic";

// The published privacy notice, terms and cookie notice. Public, so the
// registration form can link here before a client has an account, and in
// the brand named in the link (?brand=<pack id>) or the one this phone
// remembers. The wording lives in src/lib/legalDocs.ts.
const PAGES: LegalPage[] = ["privacy", "terms", "cookies"];

type Props = {
  params: Promise<{ page: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asPage(page: string): LegalPage | null {
  return (PAGES as string[]).includes(page) ? (page as LegalPage) : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const page = asPage((await params).page);
  const brand = await loginPageBrand((await searchParams).brand);
  const title = page ? LEGAL_TITLES[page] : "Not found";
  return { title, ...metadataForBrand(brand, title) };
}

export async function generateViewport({ searchParams }: Props): Promise<Viewport> {
  return viewportForBrand(await loginPageBrand((await searchParams).brand));
}

function Block({ b }: { b: LegalBlock }) {
  if (b.kind === "h") return <h2 className={styles.heading}>{b.text}</h2>;
  if (b.kind === "p") return <p className={styles.para}>{b.text}</p>;
  if (b.kind === "list")
    return (
      <ul className={styles.list}>
        {b.items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    );
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {b.head.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {b.rows.map((r) => (
            <tr key={r.join("|")}>
              {r.map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function LegalPageView({ params, searchParams }: Props) {
  const page = asPage((await params).page);
  if (!page) notFound();
  const sp = await searchParams;
  const brand = await loginPageBrand(sp.brand);
  const doc = legalDoc(page, isRegenerateBrand(brand?.name));
  // Same light page as the registration form, carrying the pack's accent.
  const lightBrand = brand ? { ...brand, theme: "dark" as const, app_layout: { ...brand.app_layout, palette: null } } : undefined;
  const q = typeof sp.brand === "string" ? `?brand=${encodeURIComponent(sp.brand)}` : "";

  return (
    <div className={styles.app} style={brandScopeStyle(lightBrand)}>
      {brand ? <BrandLinkHeader brand={brand} /> : <PageBanner />}
      <main className={styles.inner}>
        <nav className={styles.tabs} aria-label="Policies">
          {PAGES.map((p) => (
            <Link key={p} href={`/legal/${p}${q}`} className={p === page ? styles.tabActive : styles.tab} aria-current={p === page ? "page" : undefined}>
              {LEGAL_TITLES[p]}
            </Link>
          ))}
        </nav>
        <h1 className={styles.title}>{doc.title}</h1>
        <p className={styles.sub}>{doc.sub}</p>
        <p className={styles.version}>{doc.version}</p>
        {doc.blocks.map((b, i) => (
          <Block key={i} b={b} />
        ))}
      </main>
    </div>
  );
}
