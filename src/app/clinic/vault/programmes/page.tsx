import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../ClinicBrandbar";
import VaultTabs from "../VaultTabs";
import ProgrammeTemplatesLibraryClient, { type ProgrammeTemplateCard } from "./ProgrammeTemplatesLibraryClient";
import styles from "../VaultLibrary.module.css";

// Same reasoning as the other Vault tabs -- no dynamic API of its own, so
// without this the library would freeze at whatever templates looked like
// at build time.
export const dynamic = "force-dynamic";

type TemplateRow = {
  id: string;
  name: string;
  block_length_weeks: number;
  tags: string[] | null;
  programme_template_phases: { name: string; start_week: number; end_week: number; sort_order: number }[];
};

export default async function VaultProgrammesPage() {
  const { data, error } = await supabaseAdmin
    .from("programme_templates")
    .select("id, name, block_length_weeks, tags, programme_template_phases(name, start_week, end_week, sort_order)")
    .order("name")
    .returns<TemplateRow[]>();

  if (error) {
    throw new Error(`Vault programme template library query failed: ${error.message}`);
  }

  const templates: ProgrammeTemplateCard[] = (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    weeks: t.block_length_weeks,
    tags: t.tags ?? [],
    phases: [...t.programme_template_phases]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({ name: p.name, startWeek: p.start_week, endWeek: p.end_week })),
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
