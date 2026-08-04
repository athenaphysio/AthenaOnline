"use client";

import AudioRecorder from "../../AudioRecorder";
import clinicStyles from "../../clinic.module.css";

type Props = {
  programmeId: string;
  programmeTitle: string;
  existingUrl: string | null;
};

// Prompted here, on the patient record, once a scheduled block has
// actually finished -- so the message can reference how the block went,
// not a generic recording made in advance. Plays back on the patient's own
// "You did it" screen (src/app/session/PostBlockDoors.tsx).
export default function CompletionAudioRecorder({ programmeId, programmeTitle, existingUrl }: Props) {
  async function uploadAudio(blob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("programme_id", programmeId);
    formData.append("audio", blob, "recording.webm");
    const res = await fetch("/api/clinic/audio/programme-completion", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed.");
    return data.url;
  }

  return (
    <div className={clinicStyles.card} style={{ borderLeft: "3px solid var(--crimson)" }}>
      <div className={clinicStyles.cardTitle}>{programmeTitle} is finished</div>
      <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
        Record a short &ldquo;you did it&rdquo; message, it plays once on their finish screen.
      </p>
      <AudioRecorder existingUrl={existingUrl} onUpload={uploadAudio} />
    </div>
  );
}
