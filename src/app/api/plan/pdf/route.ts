import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateImportedPlanPdf } from "@/lib/importedPlanPdf";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: plan } = await supabase
    .from("imported_plans")
    .select("id")
    .eq("patient_id", user.id)
    .eq("status", "assigned")
    .maybeSingle<{ id: string }>();
  if (!plan) return NextResponse.json({ error: "No plan found." }, { status: 404 });

  const result = await generateImportedPlanPdf(plan.id);
  if (!result) return NextResponse.json({ error: "Couldn't build the PDF." }, { status: 500 });

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
