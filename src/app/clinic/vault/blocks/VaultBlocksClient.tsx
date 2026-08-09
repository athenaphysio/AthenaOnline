"use client";

import { useState } from "react";
import type { LibraryExerciseOption } from "@/lib/blockItemsEditor";
import BlocksLibraryClient, { type BlockCard } from "./BlocksLibraryClient";
import VaultBlockBuilder from "./VaultBlockBuilder";
import styles from "./VaultBlocks.module.css";

export type { BlockCard };

export default function VaultBlocksClient({
  blocks,
  exerciseLibrary,
}: {
  blocks: BlockCard[];
  exerciseLibrary: LibraryExerciseOption[];
}) {
  const [selected, setSelected] = useState<{ kind: "exercise" | "cardio"; id: string } | null>(null);

  return (
    <div className={styles.layout}>
      <VaultBlockBuilder
        key={selected ? `${selected.kind}-${selected.id}` : "new"}
        exerciseLibrary={exerciseLibrary}
        selected={selected}
        onDone={() => setSelected(null)}
      />

      <BlocksLibraryClient
        blocks={blocks}
        selectedId={selected?.id ?? null}
        onSelect={(b) => setSelected({ kind: b.kind, id: b.id })}
      />
    </div>
  );
}
