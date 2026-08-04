import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logCommunications } from "@/lib/communications";

type GroupMemberRow = { patient_id: string };

// Sending to a group fans out into one send per current member -- a
// snapshot at send time, not a live binding, matching how every other
// "assign" action in this app already works. No uniqueness guard: a
// check-in form is meant to be sendable again and again.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: formId } = await params;
  const body = await request.json();
  const { patient_id, group_id } = body as { patient_id?: string; group_id?: string };

  if (!patient_id && !group_id) {
    return NextResponse.json({ error: "patient_id or group_id is required." }, { status: 400 });
  }

  try {
    const { data: form, error: formError } = await supabaseAdmin
      .from("forms")
      .select("title")
      .eq("id", formId)
      .maybeSingle<{ title: string }>();
    if (formError) throw new Error(formError.message);
    if (!form) return NextResponse.json({ error: "Form not found." }, { status: 404 });

    let patientIds: string[];
    if (patient_id) {
      patientIds = [patient_id];
    } else {
      const { data: members, error: membersError } = await supabaseAdmin
        .from("patient_group_members")
        .select("patient_id")
        .eq("group_id", group_id)
        .returns<GroupMemberRow[]>();
      if (membersError) throw new Error(membersError.message);
      patientIds = (members ?? []).map((m) => m.patient_id);
    }

    if (patientIds.length === 0) {
      return NextResponse.json({ error: "Nobody to send this to." }, { status: 400 });
    }

    const { error: sendsError } = await supabaseAdmin
      .from("form_sends")
      .insert(patientIds.map((pid) => ({ form_id: formId, patient_id: pid })));
    if (sendsError) throw new Error(sendsError.message);

    // Best-effort -- a missing notification never blocks the send itself;
    // the form still shows up next time the patient opens the app.
    const notificationTitle = "David sent you a form";
    const notificationBody = `"${form.title}" is ready for you to fill in.`;
    const { error: notifyError } = await supabaseAdmin.from("notifications").insert(
      patientIds.map((pid) => ({
        patient_id: pid,
        type: "form_sent",
        title: notificationTitle,
        body: notificationBody,
      }))
    );
    if (notifyError) console.error("form-sent notification failed", notifyError.message);

    await logCommunications(
      patientIds.map((pid) => ({
        patientId: pid,
        channel: "in_app" as const,
        type: "form_sent",
        title: notificationTitle,
        body: notificationBody,
      }))
    );

    return NextResponse.json({ sent: patientIds.length });
  } catch (err) {
    console.error("send form failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Send failed: ${detail}` }, { status: 500 });
  }
}
