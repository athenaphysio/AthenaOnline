"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./NotificationBell.module.css";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type Props = {
  // "banner" sits the bell's icon and unread count in cream/white instead
  // of the default stone/crimson pair, for use on the crimson SiteBanner.
  variant?: "default" | "banner";
};

export default function NotificationBell({ variant = "default" }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data ?? []);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleToggle() {
    const opening = !open;
    setOpen(opening);
    if (opening) {
      const unread = notifications.filter((n) => !n.read_at);
      if (unread.length > 0) {
        const nowIso = new Date().toISOString();
        const supabase = createClient();
        await supabase
          .from("notifications")
          .update({ read_at: nowIso })
          .in("id", unread.map((n) => n.id));
        setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: nowIso })));
      }
    }
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.bell} ${variant === "banner" ? styles.bellBanner : ""}`}
        onClick={handleToggle}
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className={`${styles.badge} ${variant === "banner" ? styles.badgeBanner : ""}`}>{unreadCount}</span>
        )}
      </button>
      {open && (
        <div className={styles.panel}>
          {notifications.length === 0 ? (
            <div className={styles.empty}>Nothing yet.</div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={styles.item}>
                <div className={styles.itemTitle}>{n.title}</div>
                {n.body && <div className={styles.itemBody}>{n.body}</div>}
                <div className={styles.itemTime}>{formatWhen(n.created_at)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
