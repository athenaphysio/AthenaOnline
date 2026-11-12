import { NextRequest, NextResponse } from "next/server";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { saveHubField } from "@/lib/onboardingHubServer";

// Save one field of the consultation hub, as written or confirmed by Dr
// David Silver PhD. An empty value clears the field.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: patientId } = await params;
  const body = (await request.json()) as { field_key?: string; value?: string; status?: string; source?: string | null };
  if (!body.field_key) return NextResponse.json({ error: "Missing field." }, { status: 400 });
  const value = String(body.value ?? "");
  if (value.length > 20_000) return NextResponse.json({ error: "That is more text than one field can hold." }, { status: 400 });
  const status = body.status === "confirmed" ? "confirmed" : "to_confirm";
  try {
    const saved = await saveHubField({
      patientId,
      fieldKey: body.field_key,
      value,
      status,
      source: body.source ?? null,
    });
    return NextResponse.json({ field: saved });
  } catch (err) {
    console.error("save hub field failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
