"use client";

import { useState } from "react";
import type { LibraryExerciseOption } from "@/lib/blockItemsEditor";
import type { BlockUsageTag } from "@/lib/blockUsageTags";
import BlocksLibraryClient, { type BlockCard } from "./BlocksLibraryClient";
import VaultBlockBuilder from "./VaultBlockBuilder";
import styles from "./VaultBlocks.module.css";

export type { BlockCard };

export default function VaultBlocksClient({
  blocks,
  exerciseLibrary,
  usageTagCatalog,
}: {
  blocks: BlockCard[];
  exerciseLibrary: LibraryExerciseOption[];
  usageTagCatalog: BlockUsageTag[];
}) {
  const [selected, setSelected] = useState<{ kind: "exercise" | "cardio"; id: string } | null>(null);
  const [catalog, setCatalog] = useState<BlockUsageTag[]>(usageTagCatalog);

  return (
    <div className={styles.layout}>
      <VaultBlockBuilder
        key={selected ? `${selected.kind}-${selected.id}` : "new"}
        exerciseLibrary={exerciseLibrary}
        usageTagCatalog={catalog}
        onUsageTagCreated={(tag) => setCatalog((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))}
        selected={selected}
        onDone={() => setSelected(null)}
      />

      <BlocksLibraryClient
        blocks={blocks}
        usageTagCatalog={catalog}
        selectedId={selected?.id ?? null}
        onSelect={(b) => setSelected({ kind: b.kind, id: b.id })}
      />
    </div>
  );
}
