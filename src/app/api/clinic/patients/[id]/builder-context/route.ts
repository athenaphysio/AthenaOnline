import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { listContextEntries } from "@/lib/clientBackground";
import { timepointLabel } from "@/lib/passport";

// Everything the Programme Builder (a Claude Project outside the app)
// needs to know about one client, as one block of plain text to paste in:
// every Twofold consultation note and every Programme intake or Quick
// update form, oldest first, so the builder reads the client's story in
// order. Read only; nothing is changed.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("first_name, last_name")
    .eq("id", id)
    .maybeSingle<{ first_name: string; last_name: string | null }>();
  if (!patient) return NextResponse.json({ error: "Client not found." }, { status: 404 });

  const entries = (await listContextEntries(id)).slice().reverse();
  const name = [patient.first_name, patient.last_name].filter(Boolean).join(" ");
  const today = ukDate(new Date().toISOString().slice(0, 10));

  const parts: string[] = [
    `CLIENT: ${name}`,
    `Copied from Athena Online on ${today}. ${entries.length} ${entries.length === 1 ? "entry" : "entries"} below, oldest first.`,
  ];

  if (entries.length === 0) {
    parts.push("No consultation notes or forms have been saved for this client yet.");
  }

  entries.forEach((e, i) => {
    const body = [e.summary_text?.trim(), e.notes_text?.trim() ? `FULL NOTES\n${e.notes_text.trim()}` : null]
      .filter(Boolean)
      .join("\n\n");
    parts.push(
      `========== ENTRY ${i + 1}: ${timepointLabel(e.timepoint)}, ${ukDate(e.consulted_on)} ==========\n${body || "(empty)"}`
    );
  });

  return NextResponse.json({ text: parts.join("\n\n") });
}

function ukDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
