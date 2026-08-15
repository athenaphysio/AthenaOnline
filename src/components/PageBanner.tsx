import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./PageBanner.module.css";

type Props = {
  label?: string;
  /** Wraps the logo and label in a link, e.g. back to the dashboard. */
  href?: string;
  /** Right-aligned slot, e.g. a "back" link. */
  actions?: ReactNode;
};

// The crimson, mountain-textured banner from the main dashboard
// (SiteBanner.tsx), scaled down for secondary pages that carry the same
// "Athena Physio" wordmark but not the notification bell or site menu.
export default function PageBanner({ label = "Athena Physio", href, actions }: Props) {
  const brand = (
    <>
      <div className={styles.logo}>
        <Image
          src="/icons/athena-mark.png"
          alt=""
          width={18}
          height={18}
          style={{ transform: "translate(-4.6%, 6.6%)" }}
        />
      </div>
      <div className={styles.label}>{label}</div>
    </>
  );

  return (
    <div className={styles.banner}>
      {href ? (
        <Link href={href} className={styles.brand}>
          {brand}
        </Link>
      ) : (
        <div className={styles.brand}>{brand}</div>
      )}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
