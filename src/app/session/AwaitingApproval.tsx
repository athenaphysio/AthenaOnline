"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";
import LoginHero from "../start/LoginHero";
import PageBanner from "@/components/PageBanner";
import BrandPackCookie from "@/components/BrandPackCookie";
import { loginRootProps } from "../start/loginRootProps";
import styles from "../start/start.module.css";

// What a client who created their own account sees until David approves
// it: their brand, a plain account of what happens next, and a way to check
// again or log out. Nothing of the app opens before approval.
export default function AwaitingApproval({ brand, firstName }: { brand: ResolvedBrandPack | null; firstName: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const team = brand && !brand.isAllDefault ? brand.app_layout.team_name || `the ${brand.name} team` : "Dr David Silver PhD";

  async function logOut() {
    await createClient().auth.signOut();
    router.replace("/start?mode=login");
  }

  return (
    <div {...loginRootProps(brand && !brand.isAllDefault ? brand : null, styles)}>
      {brand && !brand.isAllDefault && <BrandPackCookie packId={brand.id} />}
      {brand && !brand.isAllDefault ? <LoginHero brand={brand} /> : <PageBanner />}
      <div className={brand && !brand.isAllDefault ? `${styles.inner} ${styles.innerBranded}` : styles.inner}>
        <h1 className={styles.heading}>{firstName ? `Thank you, ${firstName}` : "Thank you"}</h1>
        <p className={styles.subheading}>
          Your account has been created and is with {team} to confirm. Once it is confirmed, your programme opens here
          the next time you visit, and you will not need to log in again on this phone.
        </p>
        <button
          type="button"
          className={styles.button}
          disabled={checking}
          onClick={() => {
            setChecking(true);
            router.refresh();
            setTimeout(() => setChecking(false), 1500);
          }}
        >
          {checking ? "Checking…" : "Check again"}
        </button>
        <button
          type="button"
          onClick={logOut}
          style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: "inherit", opacity: 0.7, fontSize: 13.5, textDecoration: "underline", cursor: "pointer" }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
