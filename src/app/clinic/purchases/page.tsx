import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatPriceGBP } from "@/lib/currency";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";

// See the matching comment on src/app/clinic/page.tsx -- this page has no
// dynamic API to trigger dynamic rendering automatically, so without this
// it would freeze at whatever the purchase list looked like at build time.
export const dynamic = "force-dynamic";

type PurchaseRow = {
  id: string;
  patient_id: string;
  programme_title: string;
  amount_gbp: number;
  status: "paid" | "refunded";
  created_at: string;
  patients: { first_name: string } | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// A quick "did this person buy X" view, so checking a purchase doesn't mean
// leaving the app for Stripe's dashboard. Stripe remains the full record
// (refund handling, receipts, disputes) -- this is only what, who, when,
// and how much, read straight from the purchases table the webhook writes.
export default async function PurchasesPage() {
  const { data } = await supabaseAdmin
    .from("purchases")
    .select("id, patient_id, programme_title, amount_gbp, status, created_at, patients(first_name)")
    .order("created_at", { ascending: false })
    .returns<PurchaseRow[]>();

  const purchases = data ?? [];

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Purchases</h1>
        <p className={styles.subheading}>
          Every shop purchase, across every patient. For refunds, receipts or anything beyond this, use the
          Stripe dashboard directly.{" "}
          <Link href="/clinic/tools" className={styles.canvasLink}>
            ← Tools
          </Link>
        </p>

        {purchases.length === 0 && (
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            Nothing bought yet.
          </p>
        )}

        {purchases.map((p) => (
          <div key={p.id} className={styles.card} style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 500 }}>{p.programme_title}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                  {p.patients ? (
                    <Link href={`/clinic/patients/${p.patient_id}`} style={{ color: "var(--crimson)" }}>
                      {p.patients.first_name}
                    </Link>
                  ) : (
                    "Unknown client"
                  )}
                  {" · "}
                  {formatDate(p.created_at)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{formatPriceGBP(p.amount_gbp)}</span>
                <span
                  className={`${styles.statusPill} ${p.status === "paid" ? styles.statusActive : styles.statusLapsed}`}
                >
                  {p.status === "paid" ? "Paid" : "Refunded"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
