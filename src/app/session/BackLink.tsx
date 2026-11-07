"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import styles from "./TodaySession.module.css";

export type BackTarget = { href: string; label: string };

// The way back out of a programme screen. When the client arrived from
// another screen in the app, tapping it returns them to exactly where they
// were (home, the programme tab, or their week). When they arrived from a
// link in an email or WhatsApp, there is nothing in the app to go back to,
// so it takes them to the screen named in href instead.
export default function BackLink({ href, label }: BackTarget) {
  const router = useRouter();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (typeof window === "undefined") return;
    let cameFromApp = false;
    try {
      cameFromApp =
        window.history.length > 1 &&
        document.referrer !== "" &&
        new URL(document.referrer).origin === window.location.origin;
    } catch {
      cameFromApp = false;
    }
    if (cameFromApp) {
      e.preventDefault();
      router.back();
    }
  }

  return (
    <Link href={href} onClick={handleClick} className={styles.backLink}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  );
}
