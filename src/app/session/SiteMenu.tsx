"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./TodaySession.module.css";
import { DEFAULT_APP_LAYOUT, type HomeItemKey } from "@/lib/appLayout";

// The full list of the app's own sections, in the same order they appear
// down the landing page (QuickLinks, then Explore, then Meet David &
// Friends). Free Resources is now its own real Explore tile/page rather
// than a section on this page, so it gets a real route like everything
// else; Explore itself still has no route of its own, just an anchor,
// since SiteBanner (and so this menu) only ever renders on /session.
// Each item follows the home page switch of the same name on the client's
// brand pack, so an item switched off there cannot be reached from here.
const MENU_ITEMS: { label: string; href: string; key: HomeItemKey }[] = [
  { label: "Memberships", href: "/membership", key: "memberships" },
  { label: "Recommended equipment", href: "/equipment", key: "equipment" },
  { label: "Booking", href: "/book", key: "booking" },
  { label: "Free Resources", href: "/shop/free-resources", key: "resources" },
  { label: "Explore", href: "#explore", key: "explore" },
  { label: "Meet David & Friends", href: "/about", key: "meet_david" },
];

export default function SiteMenu({ show = DEFAULT_APP_LAYOUT.home }: { show?: Record<HomeItemKey, boolean> }) {
  const items = MENU_ITEMS.filter((i) => show[i.key]);
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

  if (items.length === 0) return null;

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
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={styles.siteMenuItem} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
