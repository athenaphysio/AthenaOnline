"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./TodaySession.module.css";

// The full list of the app's own sections, in the same order they appear
// down the landing page (QuickLinks, then Free Resources and Explore,
// then Meet David & Friends). Free Resources and Explore have no route of
// their own -- they're anchors on this same page, since SiteBanner (and so
// this menu) only ever renders on /session.
const MENU_ITEMS: { label: string; href: string }[] = [
  { label: "Memberships", href: "/membership" },
  { label: "Recommended equipment", href: "/equipment" },
  { label: "Booking", href: "/book" },
  { label: "Free Resources", href: "#free-resources" },
  { label: "Explore", href: "#explore" },
  { label: "Meet David & Friends", href: "/about" },
];

export default function SiteMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div style={{ position: "relative" }} ref={wrapRef}>
      <button
        type="button"
        className={styles.siteMenuButton}
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open && (
        <div className={styles.siteMenuPanel}>
          {MENU_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={styles.siteMenuItem} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
