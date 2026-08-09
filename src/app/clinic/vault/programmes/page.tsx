import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../ClinicBrandbar";
import VaultTabs from "../VaultTabs";
import ProgrammeTemplatesLibraryClient, { type ProgrammeTemplateCard } from "./ProgrammeTemplatesLibraryClient";
import styles from "../VaultLibrary.module.css";

// Same reasoning as the other Vault tabs -- no dynamic API of its own, so
// without this the library would freeze at whatever templates looked like
// at build time.
export const dynamic = "force-dynamic";

type TemplateRow = { id: string; name: string; block_length_weeks: number; tags: string[] | null };

export default async function VaultProgrammesPage() {
  const { data, error } = await supabaseAdmin
    .from("programme_templates")
    .select("id, name, block_length_weeks, tags")
    .order("name")
    .returns<TemplateRow[]>();

  if (error) {
    throw new Error(`Vault programme template library query failed: ${error.message}`);
  }

  // No phase concept exists anywhere in the schema yet (confirmed against
  // patients/[id]/dashboard/page.tsx's own "no concept of sub-phases"
  // finding) -- every template's phase breakdown is genuinely empty for
  // now, not a data gap specific to any one row.
  const templates: ProgrammeTemplateCard[] = (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    weeks: t.block_length_weeks,
    tags: t.tags ?? [],
    phases: [],
  }));

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <ClinicBrandbar />

        <div className={styles.topbar}>
          <div>
            <h1>Vault</h1>
            <div className={styles.sub}>Build and manage your reusable exercises, blocks, sessions, and programmes</div>
          </div>
        </div>

        <VaultTabs active="programmes" />

        <ProgrammeTemplatesLibraryClient templates={templates} />
      </div>
    </div>
  );
}
