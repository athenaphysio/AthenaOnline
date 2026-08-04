import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

export type CommunicationChannel = "email" | "in_app";

export type CommunicationInput = {
  patientId: string;
  channel: CommunicationChannel;
  type: string;
  title: string;
  body?: string | null;
};

// The single place every send path -- the programme-ready email and its
// matching in-app notice today, form-sent notices, and any future upsell or
// renewal email -- records itself into the Communications log a patient's
// record shows. Call this right after a send succeeds, never before, so the
// log only ever reflects what actually went out. Best-effort like the
// notifications inserts it usually sits next to: a logging failure is worth
// knowing about but should never fail the send itself, so this never throws.
export async function logCommunications(rows: CommunicationInput[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin.from("communications").insert(
    rows.map((r) => ({
      patient_id: r.patientId,
      channel: r.channel,
      type: r.type,
      title: r.title,
      body: r.body ?? null,
    }))
  );
  if (error) console.error("log communication failed", error.message);
}

export async function logCommunication(row: CommunicationInput): Promise<void> {
  await logCommunications([row]);
}
