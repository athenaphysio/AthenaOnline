import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClientRecordShell from "../ClientRecordShell";
import styles from "../dashboard/ClientDashboard.module.css";
import { listClientDocuments, listContextEntries, listPhysicalEntries } from "@/lib/clientBackground";
import { loadClinicPassport } from "@/lib/passportServer";
import { countArms } from "@/lib/backgroundSummary";
import { PERSON_ARMS, type BackgroundPart } from "@/lib/personMap";
import PassportClinicPanel from "../passport/PassportClinicPanel";
import ContextPanel from "./ContextPanel";
import DocumentsPanel from "./DocumentsPanel";
import PersonMap from "./PersonMap";
import PhysicalPanel from "./PhysicalPanel";
import PhotoControl from "./PhotoControl";
import { photoLink } from "@/lib/clientPhoto";

export const dynamic = "force-dynamic";

// Client background: the person at the centre, with the Client context
// summary and full notes, and three arms around them. Physiology (the
// health passport), Psychology (psychometrics) and Physicality (physical
// capacity).
export default async function ClientBackgroundPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ part?: string }>;
}) {
  const { id } = await params;
  const { part: rawPart } = await searchParams;
  // Older links used part=context, passport and questionnaires.
  const legacy: Record<string, BackgroundPart> = { context: "person", passport: "physiology", questionnaires: "psychology" };
  const part: BackgroundPart = PERSON_ARMS.some((a) => a.key === rawPart) ? (rawPart as BackgroundPart) : legacy[rawPart ?? ""] ?? "person";
  const base = `/clinic/patients/${id}/background`;

  const [{ data: patient }, arms] = await Promise.all([
    supabaseAdmin.from("patients").select("first_name, last_name, photo_path").eq("id", id).maybeSingle<{ first_name: string; last_name: string | null; photo_path: string | null }>(),
    countArms(id),
  ]);
  const firstName = patient?.first_name ?? "this client";
  const arm = PERSON_ARMS.find((a) => a.key === part);
  const photoUrl = await photoLink(patient?.photo_path);

  return (
    <ClientRecordShell patientId={id} active="background">
      <div style={{ margin: "-6px 0 6px" }}>
        <PersonMap base={base} active={part} arms={arms} />
      </div>

      <div style={{ margin: "10px 0 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 30 }}>{arm ? arm.label : "Client context"}</h2>
          <p className={styles.muted} style={{ margin: "4px 0 0", fontSize: 14 }}>
            {arm
              ? `${arm.source}: ${arm.detail}.`
              : `${firstName}'s story, from your consultation: the Client context summary, with the full background notes behind it.`}
          </p>
        </div>
        {part === "person" && <PhotoControl patientId={id} clientName={firstName} hasPhoto={!!photoUrl} />}
      </div>

      {part === "person" && <PersonPart patientId={id} clientName={firstName} />}
      {part === "physiology" && <PassportPart patientId={id} domains={PERSON_ARMS[0].domains} />}
      {part === "psychology" && <PsychologyPart patientId={id} clientName={firstName} />}
      {part === "physicality" && <PhysicalityPart patientId={id} clientName={firstName} />}
    </ClientRecordShell>
  );
}

async function PersonPart({ patientId, clientName }: { patientId: string; clientName: string }) {
  const [entries, notes] = await Promise.all([listContextEntries(patientId), listClientDocuments(patientId, "consultation_notes")]);
  return <ContextPanel patientId={patientId} clientName={clientName} entries={entries} notes={notes} />;
}

async function PassportPart({ patientId, domains, heading }: { patientId: string; domains: readonly string[]; heading?: string }) {
  const { results, markers, patient } = await loadClinicPassport(patientId);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {heading && <h3 style={{ margin: "8px 0 0" }}>{heading}</h3>}
      <PassportClinicPanel
        patientId={patientId}
        clientName={patient?.first_name ?? "the client"}
        initialEnabled={patient?.passport_enabled ?? false}
        markers={markers}
        results={results}
        domains={domains}
      />
    </div>
  );
}

async function PsychologyPart({ patientId, clientName }: { patientId: string; clientName: string }) {
  const docs = await listClientDocuments(patientId, "questionnaire");
  return (
    <>
      <DocumentsPanel patientId={patientId} documents={docs} clientName={clientName} />
      <div style={{ marginTop: 22 }}>
        <PassportPart patientId={patientId} domains={PERSON_ARMS[1].domains} heading="Psychometric scores in the passport" />
      </div>
    </>
  );
}

async function PhysicalityPart({ patientId, clientName }: { patientId: string; clientName: string }) {
  const [entries, files] = await Promise.all([listPhysicalEntries(patientId), listClientDocuments(patientId, "physical")]);
  return (
    <>
      <PhysicalPanel patientId={patientId} clientName={clientName} entries={entries} files={files} />
      <div style={{ marginTop: 22 }}>
        <PassportPart patientId={patientId} domains={PERSON_ARMS[2].domains} heading="Scores in the passport, charted over time" />
      </div>
    </>
  );
}
