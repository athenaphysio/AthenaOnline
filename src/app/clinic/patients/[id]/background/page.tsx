import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClientRecordShell from "../ClientRecordShell";
import styles from "../dashboard/ClientDashboard.module.css";
import { listClientDocuments, listContextEntries } from "@/lib/clientBackground";
import { loadClinicPassport } from "@/lib/passportServer";
import { getClinicSettings } from "@/lib/clinicSettings";
import { emptyContext } from "@/lib/clientContext";
import PassportClinicPanel from "../passport/PassportClinicPanel";
import ContextPanel from "./ContextPanel";
import DocumentsPanel from "./DocumentsPanel";

export const dynamic = "force-dynamic";

type Part = "context" | "passport" | "questionnaires";

// Client background: everything that builds the contextual layer for this
// client. Client context (from the onboarding consultation), their health
// passport data, and completed questionnaires.
export default async function ClientBackgroundPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ part?: string }>;
}) {
  const { id } = await params;
  const { part: rawPart } = await searchParams;
  const part: Part = rawPart === "passport" || rawPart === "questionnaires" ? rawPart : "context";
  const base = `/clinic/patients/${id}/background`;

  const parts: { key: Part; label: string }[] = [
    { key: "context", label: "Client context" },
    { key: "passport", label: "Health passport" },
    { key: "questionnaires", label: "Questionnaires" },
  ];

  return (
    <ClientRecordShell patientId={id} active="background">
      <nav className={styles.subTabs} aria-label="Client background">
        {parts.map((p) => (
          <a
            key={p.key}
            href={p.key === "context" ? base : `${base}?part=${p.key}`}
            className={`${styles.subTab} ${part === p.key ? styles.subTabActive : ""}`}
            aria-current={part === p.key ? "page" : undefined}
          >
            {p.label}
          </a>
        ))}
      </nav>

      {part === "context" && <ContextPart patientId={id} />}
      {part === "passport" && <PassportPart patientId={id} />}
      {part === "questionnaires" && <QuestionnairesPart patientId={id} />}
    </ClientRecordShell>
  );
}

async function ContextPart({ patientId }: { patientId: string }) {
  const [entries, notes, { aiToolsEnabled }] = await Promise.all([
    listContextEntries(patientId),
    listClientDocuments(patientId, "consultation_notes"),
    getClinicSettings(),
  ]);
  return <ContextPanel patientId={patientId} entries={entries} notes={notes} aiOn={aiToolsEnabled} blank={emptyContext()} />;
}

async function PassportPart({ patientId }: { patientId: string }) {
  const { results, markers, patient } = await loadClinicPassport(patientId);
  return (
    <PassportClinicPanel
      patientId={patientId}
      clientName={patient?.first_name ?? "the client"}
      initialEnabled={patient?.passport_enabled ?? false}
      markers={markers}
      results={results}
    />
  );
}

async function QuestionnairesPart({ patientId }: { patientId: string }) {
  const [docs, { data: patient }] = await Promise.all([
    listClientDocuments(patientId, "questionnaire"),
    supabaseAdmin.from("patients").select("first_name").eq("id", patientId).maybeSingle<{ first_name: string }>(),
  ]);
  return <DocumentsPanel patientId={patientId} documents={docs} clientName={patient?.first_name ?? "this client"} />;
}
