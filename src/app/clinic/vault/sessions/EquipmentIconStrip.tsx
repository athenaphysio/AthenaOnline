import type { Equipment } from "@/lib/equipment";
import styles from "./VaultSessions.module.css";

// Icon-above-label chips, de-duplicated, in a horizontal row -- matches
// David's reference screenshot. An item with no icon uploaded yet shows its
// name as plain text rather than a broken image.
export default function EquipmentIconStrip({
  equipmentIds,
  equipment,
  compact = false,
}: {
  equipmentIds: string[];
  equipment: Equipment[];
  compact?: boolean;
}) {
  if (equipmentIds.length === 0) return null;

  const byId = new Map(equipment.map((e) => [e.id, e]));
  const items = equipmentIds.map((id) => byId.get(id)).filter((e): e is Equipment => e != null);
  if (items.length === 0) return null;

  return (
    <div className={`${styles.equipmentStrip} ${compact ? styles.equipmentStripCompact : ""}`}>
      {items.map((eq) =>
        eq.icon_url ? (
          <div key={eq.id} className={styles.equipmentStripItem}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={eq.icon_url} alt="" className={styles.equipmentStripIcon} />
            <span className={styles.equipmentStripLabel}>{eq.name}</span>
          </div>
        ) : (
          <span key={eq.id} className={styles.equipmentStripTextOnly}>
            {eq.name}
          </span>
        )
      )}
    </div>
  );
}
