import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findBuilderForm, sendFormToPatients } from "@/lib/sendForm";

const DAY_MS = 24 * 60 * 60 * 1000;

// Every morning: any client whose block ends within the next seven days is
// sent the Quick update form, once per programme, so their answers are
// there when David plans the next block.
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const form = await findBuilderForm("update");
  if (!form) return NextResponse.json({ sent: 0, reason: "Quick update form is not in the Forms library" });

  const { data: programmes, error } = await supabaseAdmin
    .from("programmes")
    .select("id, patient_id, start_date, block_length_weeks")
    .eq("delivery_mode", "scheduled")
    .is("access_paused_at", null)
    .is("quick_update_sent_at", null)
    .not("patient_id", "is", null)
    .returns<{ id: string; patient_id: string; start_date: string; block_length_weeks: number }[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const due = (programmes ?? []).filter((p) => {
    const end = new Date(p.start_date).getTime() + p.block_length_weeks * 7 * DAY_MS;
    return end > now && end - now <= 7 * DAY_MS;
  });

  let sent = 0;
  for (const p of due) {
    // Claim first so a second run never sends it twice.
    const { data: claimed } = await supabaseAdmin
      .from("programmes")
      .update({ quick_update_sent_at: new Date().toISOString() })
      .eq("id", p.id)
      .is("quick_update_sent_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    try {
      sent += await sendFormToPatients(form.id, form.title, [p.patient_id]);
    } catch (err) {
      console.error("automatic quick update failed", p.id, err);
      await supabaseAdmin.from("programmes").update({ quick_update_sent_at: null }).eq("id", p.id);
    }
  }
  return NextResponse.json({ sent });
}
