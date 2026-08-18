"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";
import styles from "../equipment/EquipmentManager.module.css";

export type FriendRow = { id: string; name: string; job_title: string | null; photo_url: string | null; sort_order: number };

function FriendRowItem({
  item,
  isFirst,
  isLast,
  onMove,
}: {
  item: FriendRow;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/friends/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Remove failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.");
      setDeleting(false);
    }
  }

  return (
    <div className={styles.row}>
      <div className={styles.iconSlot}>
        {item.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photo_url} alt="" className={styles.iconImg} />
        ) : (
          <div className={styles.iconPlaceholder}>{item.name.charAt(0).toUpperCase()}</div>
        )}
      </div>

      <div className={styles.name}>
        {item.name}
        {item.job_title && <span style={{ fontWeight: 400, color: "var(--graphite)" }}> &middot; {item.job_title}</span>}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={clinicStyles.buttonSecondary}
          style={{ width: "auto", padding: "0 12px", height: 34 }}
          disabled={isFirst}
          onClick={() => onMove(-1)}
          aria-label="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          className={clinicStyles.buttonSecondary}
          style={{ width: "auto", padding: "0 12px", height: 34 }}
          disabled={isLast}
          onClick={() => onMove(1)}
          aria-label="Move down"
        >
          ↓
        </button>
        <Link href={`/clinic/vault/friends/${item.id}`} className={clinicStyles.buttonSecondary} style={{ width: "auto", padding: "0 16px", height: 34, display: "flex", alignItems: "center", textDecoration: "none" }}>
          Edit
        </Link>
        <button
          type="button"
          className={clinicStyles.buttonSecondary}
          style={{ width: "auto", padding: "0 16px", height: 34 }}
          onClick={() => setConfirmingDelete(true)}
        >
          Remove
        </button>

        {error && <span className={styles.error}>{error}</span>}
      </div>

      {confirmingDelete && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            <p>Remove &ldquo;{item.name}&rdquo; from the Meet David &amp; Friends page?</p>
            <div className={styles.confirmActions}>
              <button type="button" className={clinicStyles.buttonSecondary} onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
              <button type="button" className={clinicStyles.button} onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FriendsListClient({ friends }: { friends: FriendRow[] }) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);

  async function move(index: number, direction: -1 | 1) {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= friends.length || moving) return;
    setMoving(true);
    try {
      const a = friends[index];
      const b = friends[otherIndex];
      await Promise.all([
        fetch(`/api/clinic/friends/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: b.sort_order }),
        }),
        fetch(`/api/clinic/friends/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: a.sort_order }),
        }),
      ]);
      router.refresh();
    } finally {
      setMoving(false);
    }
  }

  return (
    <div>
      {friends.map((item, i) => (
        <FriendRowItem
          key={item.id}
          item={item}
          isFirst={i === 0}
          isLast={i === friends.length - 1}
          onMove={(direction) => move(i, direction)}
        />
      ))}
    </div>
  );
}
