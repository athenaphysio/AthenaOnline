import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { APP_URL } from "@/lib/appUrl";
import { sendClinicianPasswordResetEmail } from "@/lib/email";

// "Forgot your password?" on the clinician login. Sends a one time link only
// when the email belongs to a clinician (staff role "coach"), and says
// nothing either way, so the page cannot be used to find out who works here.
// The link opens /start/set-password, which signs them in with the token and
// lets them choose a new password, then takes them back to the clinic side.
const recent = new Map<string, number>();

export async function requestCoachPasswordReset(email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return;
  const last = recent.get(clean);
  if (last && Date.now() - last < 2 * 60 * 1000) return;
  recent.set(clean, Date.now());

  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("id, name, email, role")
    .ilike("email", clean)
    .maybeSingle<{ id: string; name: string | null; email: string; role: string }>();
  if (!staff || staff.role !== "coach") return;

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email: staff.email });
  if (error || !data?.properties?.hashed_token) {
    console.error("coach password reset link failed", error?.message);
    return;
  }
  const url = `${APP_URL}/start/set-password?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery&next=coach`;
  try {
    await sendClinicianPasswordResetEmail(staff.email, staff.name ?? "", url);
  } catch (err) {
    console.error("coach password reset email failed", err);
  }
}
