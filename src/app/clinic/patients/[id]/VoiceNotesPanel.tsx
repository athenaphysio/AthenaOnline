import { supabaseAdmin } from "@/lib/supabaseAdmin";
import clinicStyles from "../../clinic.module.css";
import VoiceNotesControls from "./VoiceNotesControls";

type Note = {
  id: string;
  transcript: string;
  context_title: string | null;
  week_number: number | null;
  duration_seconds: number | null;
  read_at: string | null;
  created_at: string;
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

// The client's voice notes, newest first, each tied to the practice it was
// about, plus the switch that shows or hides the button in their app.
export default async function VoiceNotesPanel({ patientId, firstName }: { patientId: string; firstName: string }) {
  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("voice_notes_enabled")
    .eq("id", patientId)
    .maybeSingle<{ voice_notes_enabled: boolean }>();
  const enabled = patient?.voice_notes_enabled === true;

  const { data: notes } = await supabaseAdmin
    .from("voice_notes")
    .select("id, transcript, context_title, week_number, duration_seconds, read_at, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(15)
    .returns<Note[]>();
  const list = notes ?? [];
  const unread = list.filter((n) => !n.read_at).length;

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Voice notes{unread > 0 ? ` (${unread} new)` : ""}</div>
      <VoiceNotesControls patientId={patientId} initialEnabled={enabled} hasUnread={unread > 0} />
      {list.length === 0 ? (
        <p className={clinicStyles.notice} style={{ marginTop: 10 }}>
          {enabled
            ? `Nothing from ${firstName} yet. The button appears after each practice in their app.`
            : `Turn this on and ${firstName} sees a button after each practice to tell you how it went. Only the text is kept; the audio is never stored.`}
        </p>
      ) : (
        <div style={{ marginTop: 10 }}>
          {list.map((n) => (
            <div key={n.id} style={{ padding: "8px 0", borderTop: "1px solid var(--cream)" }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {!n.read_at && <b style={{ color: "var(--ink)" }}>New · </b>}
                {when(n.created_at)}
                {n.context_title ? `, ${n.context_title}` : ""}
                {n.week_number ? `, week ${n.week_number}` : ""}
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 2 }}>{n.transcript}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
