import { NextRequest, NextResponse } from "next/server";
import { sendTestEmail } from "@/lib/email";
import { SAMPLE_VARS_BY_KEY, renderTemplate, type EmailTemplateKey } from "@/lib/emailTemplates";

const OWNER_EMAIL = "athenaphysio@gmail.com";

// Phase 5's "send me a test" button. Deliberately bypasses the approval
// gate entirely -- sendTestEmail never checks status, since the whole
// point is previewing a pending template before it's approved, not
// after. Always sends to David's own inbox, never a patient's, and
// always the current form contents, saved or not.
export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const body = await request.json();
  const { subject, body: templateBody } = body as { subject: string; body: string };

  const vars = SAMPLE_VARS_BY_KEY[key as EmailTemplateKey];
  if (!vars) {
    return NextResponse.json({ error: "Unknown template." }, { status: 400 });
  }
  if (!subject?.trim() || !templateBody?.trim()) {
    return NextResponse.json({ error: "Subject and body can't be empty." }, { status: 400 });
  }

  try {
    const renderedSubject = renderTemplate(subject, vars);
    const renderedBody = renderTemplate(templateBody, vars);
    await sendTestEmail(key as EmailTemplateKey, renderedSubject, renderedBody, OWNER_EMAIL);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("test email send failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
