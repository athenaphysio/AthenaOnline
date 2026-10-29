import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveBrandPack, type ResolvedBrandPack } from "@/lib/brandPackResolve";
import { toolbarTabs, type AppLayout, type ToolbarTab } from "@/lib/appLayout";

// Everything a page in the client's app needs to know about how it should
// look and what it should offer: the client's brand pack, the app layout
// that comes with it, whether their passport is on, and the toolbar tabs
// that follow from those. Shared by the client's own app and the clinic's
// Client view, so the two never differ.

export type ClientAppContext = {
  userId: string;
  brand: ResolvedBrandPack;
  layout: AppLayout;
  passportEnabled: boolean;
  tabs: ToolbarTab[];
  scheduledProgrammeId: string | null;
};

export async function loadClientApp(userId: string): Promise<ClientAppContext> {
  const [{ data: passportRow }, { data: programmes }] = await Promise.all([
    supabaseAdmin.from("patients").select("passport_enabled").eq("id", userId).maybeSingle<{ passport_enabled: boolean }>(),
    supabaseAdmin
      .from("programmes")
      .select("id, delivery_mode")
      .eq("patient_id", userId)
      .is("access_paused_at", null)
      .order("created_at", { ascending: false })
      .returns<{ id: string; delivery_mode: string }[]>(),
  ]);
  const scheduledProgrammeId = (programmes ?? []).find((p) => p.delivery_mode === "scheduled")?.id ?? null;
  const brand = await resolveBrandPack({ patientId: userId, programmeId: scheduledProgrammeId });
  const passportEnabled = passportRow?.passport_enabled === true;
  return {
    userId,
    brand,
    layout: brand.app_layout,
    passportEnabled,
    tabs: toolbarTabs(brand.app_layout, passportEnabled),
    scheduledProgrammeId,
  };
}

// Whether a tab may be opened at all, for the pages behind each tab.
export function tabAllowed(ctx: ClientAppContext, key: ToolbarTab["key"]): boolean {
  return ctx.tabs.some((t) => t.key === key);
}

export type PendingForm = { sendId: string; title: string };

// Forms sent to the client that they have not answered yet, newest first,
// one per form. Runs under the client's own login (or the clinic's, in
// the Client view), then fetches titles with the service role once
// ownership is proven, since forms have no client read policy.
export async function loadPendingForms(db: SupabaseClient, userId: string): Promise<PendingForm[]> {
  type SendRow = { id: string; form_id: string };
  const [{ data: sends }, { data: responses }] = await Promise.all([
    db.from("form_sends").select("id, form_id").eq("patient_id", userId).order("sent_at", { ascending: false }).returns<SendRow[]>(),
    db.from("form_responses").select("form_send_id").eq("patient_id", userId).returns<{ form_send_id: string }[]>(),
  ]);
  const answered = new Set((responses ?? []).map((r) => r.form_send_id));
  const seen = new Set<string>();
  const pending: SendRow[] = [];
  for (const s of sends ?? []) {
    if (answered.has(s.id) || seen.has(s.form_id)) continue;
    seen.add(s.form_id);
    pending.push(s);
  }
  if (pending.length === 0) return [];
  const { data: forms } = await supabaseAdmin
    .from("forms")
    .select("id, title")
    .in(
      "id",
      pending.map((s) => s.form_id),
    )
    .returns<{ id: string; title: string }[]>();
  const titles = new Map((forms ?? []).map((f) => [f.id, f.title]));
  return pending.filter((s) => titles.has(s.form_id)).map((s) => ({ sendId: s.id, title: titles.get(s.form_id)! }));
}
