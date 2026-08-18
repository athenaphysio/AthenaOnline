"use client";

import { useState } from "react";
import type { BlockCard } from "@/lib/vaultBlocksLibrary";
import type { Equipment } from "@/lib/equipment";
import type { BlockUsageTag } from "@/lib/blockUsageTags";
import SessionsLibraryClient, { type SessionCard } from "./SessionsLibraryClient";
import VaultSessionBuilder from "./VaultSessionBuilder";
import styles from "./VaultSessions.module.css";

export type { SessionCard };

export default function VaultSessionsClient({
  sessions,
  blocks,
  usageTagCatalog,
  equipment,
  exerciseEquipment,
}: {
  sessions: SessionCard[];
  blocks: BlockCard[];
  usageTagCatalog: BlockUsageTag[];
  equipment: Equipment[];
  exerciseEquipment: Record<string, string[]>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className={styles.layout}>
      <VaultSessionBuilder
        key={selectedId ?? "new"}
        blocks={blocks}
        usageTagCatalog={usageTagCatalog}
        equipment={equipment}
        exerciseEquipment={exerciseEquipment}
        selectedId={selectedId}
        onDone={() => setSelectedId(null)}
      />

      <SessionsLibraryClient sessions={sessions} equipment={equipment} selectedId={selectedId} onSelect={(s) => setSelectedId(s.id)} />
    </div>
  );
}
