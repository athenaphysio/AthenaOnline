"use client";

import { useState } from "react";
import type { BlockCard } from "@/lib/vaultBlocksLibrary";
import SessionsLibraryClient, { type SessionCard } from "./SessionsLibraryClient";
import VaultSessionBuilder from "./VaultSessionBuilder";
import styles from "./VaultSessions.module.css";

export type { SessionCard };

export default function VaultSessionsClient({ sessions, blocks }: { sessions: SessionCard[]; blocks: BlockCard[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className={styles.layout}>
      <VaultSessionBuilder key={selectedId ?? "new"} blocks={blocks} selectedId={selectedId} onDone={() => setSelectedId(null)} />

      <SessionsLibraryClient sessions={sessions} selectedId={selectedId} onSelect={(s) => setSelectedId(s.id)} />
    </div>
  );
}
