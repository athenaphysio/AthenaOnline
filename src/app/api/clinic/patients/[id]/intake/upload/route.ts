import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadIntakeFile } from "@/lib/intakeFileUpload";
import { extractIntakeForm, type IntakeFormFields } from "@/lib/extractIntakeForm";

const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

type PatientReferralRow = IntakeFormFields;

// Upload + read, one request: stores the file (kept attached permanently,
// never deleted), then runs the same document straight through extraction
// and hands back both the extracted fields and the patient's current
// values for each, so the review screen can flag conflicts before David
// confirms anything. Nothing is written to the patient row here -- that's
// PATCH .../intake/save, only once he's reviewed.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof Blob) || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  const mimeType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (!ACCEPTED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "That file type isn't supported. Please upload a PDF, JPG, PNG, or DOCX." },
      { status: 400 }
    );
  }

  try {
    const documentId = crypto.randomUUID();
    const storagePath = await uploadIntakeFile(patientId, documentId, file);

    const { error: insertError } = await supabaseAdmin.from("patient_intake_documents").insert({
      id: documentId,
      patient_id: patientId,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: mimeType,
    });
    if (insertError) throw new Error(insertError.message);

    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractIntakeForm({ mimeType, buffer });

    const { data: current, error: patientError } = await supabaseAdmin
      .from("patients")
      .select("presenting_complaint, date_of_onset, mechanism_of_injury, body_region, referred_via, referral_goals_history")
      .eq("id", patientId)
      .maybeSingle<PatientReferralRow>();
    if (patientError) throw new Error(patientError.message);

    return NextResponse.json({
      document: { id: documentId, fileName: file.name },
      extracted,
      current: current ?? {
        presenting_complaint: "",
        date_of_onset: "",
        mechanism_of_injury: "",
        body_region: "",
        referred_via: "",
        referral_goals_history: "",
      },
    });
  } catch (err) {
    console.error("intake form upload/extract failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't read that form: ${detail}` }, { status: 500 });
  }
}
