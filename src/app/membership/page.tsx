import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MembershipTierList from "./MembershipTierList";
import sessionStyles from "../session/TodaySession.module.css";
import styles from "./membership.module.css";
import { resolveBrandPack } from "@/lib/brandPackResolve";
import { brandScopeStyle } from "../session/brandScopeStyle";

export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string }>;
}) {
  const { purchase } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/start");
  }

  const brand = await resolveBrandPack({ patientId: user.id });

  return (
    <div className={sessionStyles.app} style={brandScopeStyle(brand)}>
      <div className={sessionStyles.inner}>
        <div className={styles.header}>
          <Link href="/session" className={styles.backLink}>
            ← Back to your dashboard
          </Link>
          <div className={styles.heading}>Memberships</div>
          <p className={styles.continueBody}>
            Congratulations on completing your rehab. Do you want to keep working toward the movement goals that
            matter to you, whether that&apos;s family, travel, or simply feeling capable in everyday life? David now
            knows your body and can build programmes that are genuinely personal to you. Plans that fit around your
            life, not the other way round. Four tiers to choose from&hellip;
          </p>
        </div>

        {purchase === "success" && <div className={styles.banner}>Payment received, thank you. You're set up.</div>}
        {purchase === "cancelled" && (
          <div className={styles.bannerMuted}>Checkout was cancelled, nothing was charged.</div>
        )}

        <MembershipTierList />
      </div>
    </div>
  );
}
