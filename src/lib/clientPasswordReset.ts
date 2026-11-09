import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { APP_URL } from "@/lib/appUrl";
import { resolveBrandPack } from "@/lib/brandPackResolve";
import { sendClientPasswordResetEmail } from "@/lib/email";

// "Forgot your password?" on the client login. Sends a one time link only
// when the email belongs to a client, and says nothing either way, so the
// page cannot be used to find out who is a client. The link opens
// /start/set-password in the client's own brand.
const recent = new Map<string, number>();

export async function requestClientPasswordReset(email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return;
  const last = recent.get(clean);
  if (last && Date.now() - last < 2 * 60 * 1000) return;
  recent.set(clean, Date.now());

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("id, first_name, email")
    .ilike("email", clean)
    .limit(1)
    .maybeSingle<{ id: string; first_name: string | null; email: string }>();
  if (!patient) return;

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email: patient.email });
  if (error || !data?.properties?.hashed_token) {
    console.error("client password reset link failed", error?.message);
    return;
  }
  const brand = await resolveBrandPack({ patientId: patient.id }).catch(() => null);
  const brandParam = brand && !brand.isAllDefault ? `&brand=${encodeURIComponent(brand.id)}` : "";
  const url = `${APP_URL}/start/set-password?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery${brandParam}`;
  try {
    await sendClientPasswordResetEmail(patient.id, patient.email, patient.first_name ?? "", url);
  } catch (err) {
    console.error("client password reset email failed", err);
  }
}
