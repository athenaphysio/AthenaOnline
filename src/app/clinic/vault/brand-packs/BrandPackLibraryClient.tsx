"use client";

import Link from "next/link";
import styles from "./BrandPacks.module.css";
import type { BrandPack } from "@/lib/brandPack";

export default function BrandPackLibraryClient({ packs }: { packs: BrandPack[] }) {
  if (packs.length === 0) return null;

  return (
    <div className={styles.grid}>
      {packs.map((pack) => (
        <Link key={pack.id} href={`/clinic/vault/brand-packs/${pack.id}`} className={styles.card}>
          {pack.cover_square_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pack.cover_square_url} alt="" className={styles.cardThumb} />
          ) : (
            <div className={styles.cardThumbPlaceholder} style={{ background: pack.background_color }}>
              No cover yet
            </div>
          )}
          <div className={styles.cardBody}>
            <span className={styles.cardName}>{pack.name}</span>
            {pack.is_default && <span className={styles.defaultTag}>Default</span>}
          </div>
        </Link>
      ))}
    </div>
  );
}
