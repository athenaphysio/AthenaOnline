import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// The only way any of the eight template rows ever change -- see
// src/lib/emailTemplates.ts and the Phase 2 brief. status is included
// here deliberately: approving a template is just as much "editing the
// row" as changing its wording, one form, one save action.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const body = await request.json();
  const { subject, body: templateBody, status, updated_by } = body as {
    subject: string;
    body: string;
    status: "pending_review" | "approved";
    updated_by: string | null;
  };

  if (!subject?.trim() || !templateBody?.trim()) {
    return NextResponse.json({ error: "Subject and body can't be empty." }, { status: 400 });
  }
  if (status !== "pending_review" && status !== "approved") {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("email_templates")
    .update({
      subject: subject.trim(),
      body: templateBody,
      status,
      updated_by: updated_by?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("key", key);

  if (error) {
    console.error("email template update failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
