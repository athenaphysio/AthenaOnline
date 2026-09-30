import "server-only";
import { Document, Page, Text, View, Image, renderToBuffer } from "@react-pdf/renderer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveBrandPack } from "@/lib/brandPackResolve";
import { pdfStyles as styles, PdfFooter, SAFETY_LINE } from "@/lib/runningPlanPdf";
import type { AthenaPlanV1, PlanSession, PlanWeek } from "@/lib/athenaPlan";

// The athena-plan-v1 equivalent of runningPlanPdf.tsx (Step 5 of the new
// direction) -- same cover, same styles, same footer, same run log, but
// reading straight from a plan's own raw_json instead of a rung
// computation. Shows every week the plan has, not just the next few --
// there's no "whole ladder" to hide here, this plan already IS the whole
// thing David and Claude chat agreed on.

type PlanPdfData = {
  clientFirstName: string;
  brandIsDefault: boolean;
  brandWordmarkUrl: string | null;
  brandAccent: string;
  blockTitle: string;
  intro: string;
  weeks: PlanWeek[];
  moveOnText: string;
  flareText: string;
};

const TYPE_LABEL: Record<string, string> = { run: "Run", bike: "Bike", swim: "Swim", strength: "Strength", rest: "Rest", other: "Other" };
const DAY_LABEL: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun", any: "Any day" };

async function gatherImportedPlanData(importedPlanId: string): Promise<PlanPdfData | null> {
  const { data: planRow } = await supabaseAdmin
    .from("imported_plans")
    .select("raw_json, patient_id, status")
    .eq("id", importedPlanId)
    .maybeSingle<{ raw_json: AthenaPlanV1; patient_id: string; status: string }>();
  if (!planRow) return null;
  const plan = planRow.raw_json;

  const [{ data: patient }, brand] = await Promise.all([
    supabaseAdmin.from("patients").select("first_name").eq("id", planRow.patient_id).maybeSingle<{ first_name: string }>(),
    resolveBrandPack({ patientId: planRow.patient_id }),
  ]);
  if (!patient) return null;

  return {
    clientFirstName: patient.first_name,
    brandIsDefault: brand.isAllDefault,
    brandWordmarkUrl: brand.wordmark_url,
    brandAccent: brand.isAllDefault ? "#9B1C1C" : brand.accent_color,
    blockTitle: plan.block_title,
    intro: plan.intro,
    weeks: [...plan.weeks].sort((a, b) => a.week - b.week),
    moveOnText: plan.rules.move_on,
    flareText: plan.rules.flare,
  };
}

function SessionRow({ session }: { session: PlanSession }) {
  const stepsText = session.steps.map((s) => (s.label ? `${s.label}: ${s.detail}` : s.detail)).join("; ");
  return (
    <View style={styles.tr}>
      <Text style={[styles.td, { flex: 1.1 }]}>
        {TYPE_LABEL[session.type] ?? session.type}
        {session.day !== "any" ? ` (${DAY_LABEL[session.day] ?? session.day})` : ""}
        {"\n"}
        {session.title}
      </Text>
      <Text style={[styles.td, { flex: 2 }]}>{session.type === "strength" ? "Your strength session" : stepsText}</Text>
      <Text style={[styles.td, { flex: 1 }]}>{session.target}</Text>
      <Text style={[styles.td, { flex: 1, borderRightWidth: 0 }]}>{session.total}</Text>
    </View>
  );
}

function WeekTable({ week }: { week: PlanWeek }) {
  const sessions = [...week.sessions].sort((a, b) => a.order - b.order);
  return (
    <View wrap={false} style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
        Week {week.week}
        {week.label ? `, ${week.label}` : ""}
      </Text>
      {week.focus && <Text style={{ fontSize: 10, color: "#4A4A4A", marginBottom: 6 }}>{week.focus}</Text>}
      <View style={styles.table}>
        <View style={styles.tr}>
          <Text style={[styles.th, { flex: 1.1 }]}>Session</Text>
          <Text style={[styles.th, { flex: 2 }]}>Steps</Text>
          <Text style={[styles.th, { flex: 1 }]}>Target</Text>
          <Text style={[styles.th, { flex: 1, borderRightWidth: 0 }]}>Total</Text>
        </View>
        {sessions.map((s) => (
          <SessionRow key={s.id} session={s} />
        ))}
      </View>
    </View>
  );
}

function ImportedPlanDocument({ data }: { data: PlanPdfData }) {
  const createdOn = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const headingStyle = { ...styles.sectionHeading, borderBottomColor: data.brandAccent };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {!data.brandIsDefault && data.brandWordmarkUrl ? (
          <Image src={data.brandWordmarkUrl} style={{ height: 22, width: "auto", marginBottom: 14, objectFit: "contain" }} />
        ) : (
          <Text style={styles.eyebrow}>ATHENA PHYSIO</Text>
        )}
        <Text style={styles.title}>Your plan</Text>
        <Text style={styles.coverLine}>{data.clientFirstName}</Text>
        <Text style={styles.coverLine}>{data.blockTitle}</Text>
        {data.intro && <Text style={styles.coverLine}>{data.intro}</Text>}
        <Text style={styles.coverLine}>Plan from Dr David Silver PhD</Text>
        <Text style={styles.note}>Created on {createdOn}. Your app always has the latest version of your plan.</Text>

        {data.weeks.map((week) => (
          <WeekTable key={week.week} week={week} />
        ))}

        <View wrap={false}>
          <Text style={headingStyle}>Moving on</Text>
          <Text style={{ fontSize: 10.5, margin: 0 }}>{data.moveOnText}</Text>
        </View>
        <View wrap={false} style={{ marginTop: 12 }}>
          <Text style={headingStyle}>If you have a flare-up</Text>
          <Text style={{ fontSize: 10.5, marginBottom: 6 }}>{data.flareText}</Text>
          <Text style={{ fontSize: 9.5, color: "#9B1C1C" }}>{SAFETY_LINE}</Text>
        </View>

        <PdfFooter />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionHeading}>Session log</Text>
        <Text style={styles.note}>Log your sessions in the app when you can, so David can see how you're getting on.</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>Date</Text>
            <Text style={styles.th}>Session</Text>
            <Text style={styles.th}>Finished?</Text>
            <Text style={styles.th}>Pain during (0-10)</Text>
            <Text style={styles.th}>Next morning</Text>
            <Text style={[styles.th, { borderRightWidth: 0 }]}>Notes</Text>
          </View>
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={i} style={styles.tr}>
              <Text style={[styles.td, { minHeight: 22 }]}> </Text>
              <Text style={[styles.td, { minHeight: 22 }]}> </Text>
              <Text style={[styles.td, { minHeight: 22 }]}> </Text>
              <Text style={[styles.td, { minHeight: 22 }]}> </Text>
              <Text style={[styles.td, { minHeight: 22 }]}> </Text>
              <Text style={[styles.td, { minHeight: 22, borderRightWidth: 0 }]}> </Text>
            </View>
          ))}
        </View>
        <PdfFooter />
      </Page>
    </Document>
  );
}

export async function generateImportedPlanPdf(importedPlanId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const data = await gatherImportedPlanData(importedPlanId);
  if (!data) return null;

  const buffer = await renderToBuffer(<ImportedPlanDocument data={data} />);
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = data.clientFirstName.replace(/[^a-zA-Z0-9]/g, "");
  const filename = `Athena_plan_${safeName}_${dateStr}.pdf`;
  return { buffer, filename };
}
