import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { RECOMMENDED_EQUIPMENT } from "@/lib/recommendedEquipment";
import PageBanner from "@/components/PageBanner";
import styles from "./Equipment.module.css";
import { resolveBrandPack } from "@/lib/brandPackResolve";
import { brandScopeStyle } from "../session/brandScopeStyle";

// A short, honest pointer page -- Athena Online doesn't sell equipment, it
// just tells clients where Dr David Silver PhD recommends buying it. Reached
// from the "Equipment" link every patient screen carries (SessionHeader.tsx)
// and from the Explore section on the landing page. Same auth gate as the
// rest of the patient app.
export default async function EquipmentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/start");
  }

  const brand = await resolveBrandPack({ patientId: user.id });

  return (
    <div className={styles.app} style={brandScopeStyle(brand)}>
      <PageBanner
        href="/session"
        brand={brand}
        actions={
          <Link href="/session" className={styles.backLink}>
            Back
          </Link>
        }
      />
      <div className={styles.inner}>

        <div className={styles.body}>
          <h1 className={styles.heading}>Recommended equipment</h1>

          <div className={styles.introBox}>
            <p>
              The home exercise equipment and brands below are recommended by Dr David Silver PhD. The suppliers
              are selected on quality, price and trusted delivery.
            </p>
            <p>
              The links take you to the supplier&apos;s own website. If you&apos;re ever unsure whether a piece of
              equipment suits your specific programme, ask Dr David Silver PhD before you buy.
            </p>
          </div>

          <div className={styles.list}>
            {RECOMMENDED_EQUIPMENT.map((item) => (
              <div key={item.slug} className={styles.card}>
                {item.image && (
                  <div className={styles.cardImageWrap}>
                    <Image src={item.image} alt="" fill sizes="480px" className={styles.cardImage} />
                  </div>
                )}
                <div className={styles.cardBody}>
                  <div className={styles.cardName}>{item.name}</div>
                  <p className={styles.cardNote}>{item.note}</p>
                  {item.notes && <p className={styles.cardDetail}>{item.notes}</p>}
                  <a href={item.supplierUrl} target="_blank" rel="noopener noreferrer" className={styles.cardLink}>
                    {item.supplierName} ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
