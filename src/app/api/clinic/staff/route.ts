import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { friendlyPasswordError, passwordMeetsRules, PASSWORD_MIN_LENGTH } from "@/lib/passwordRules";
import { findLoginAccount } from "@/lib/loginAccount";
import { sendClinicianWelcomeEmail } from "@/lib/email";

// Sends the welcome with the login page, never failing the account creation
// if the email itself does not go out; the screen says which happened.
async function welcome(email: string, name: string): Promise<boolean> {
  try {
    const result = await sendClinicianWelcomeEmail(email, name);
    if (!result.sent) console.error("clinician welcome email not sent", result.reason);
    return result.sent;
  } catch (err) {
    console.error("clinician welcome email failed", err);
    return false;
  }
}

// Creates a real, individual Supabase Auth account for a Coach. The
// role: "coach" metadata is what handle_new_staff() (0012_staff_roles.sql)
// reads to insert the matching public.staff row -- this is the one and only
// place a Coach identity gets minted, and it's Owner-only (this route lives
// under the password-gated /api/clinic/* prefix).
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, password } = body as { name: string; email: string; password: string };

  if (!name?.trim() || !email?.trim() || !password || !passwordMeetsRules(password)) {
    return NextResponse.json(
      {
        error: `A name, an email address and a password are needed. The password needs at least ${PASSWORD_MIN_LENGTH} characters, including a capital letter, a small letter, a number and a symbol.`,
      },
      { status: 400 }
    );
  }

  try {
    // Someone who already uses the app (a client, for example) keeps their
    // one login and gains coach access on top. Their client record and app
    // stay exactly as they were.
    const existing = await findLoginAccount(email);
    if (existing) {
      const { data: already } = await supabaseAdmin.from("staff").select("id").eq("id", existing.id).maybeSingle();
      if (already) return NextResponse.json({ error: "This person already has a Coach account." }, { status: 409 });

      const { error: staffError } = await supabaseAdmin
        .from("staff")
        .insert({ id: existing.id, name: name.trim(), email: existing.email, role: "coach" });
      if (staffError) throw new Error(staffError.message);

      // Never overwrite a password someone already uses. Only a login that
      // has never been used (an invite they did not finish) takes the one
      // typed here, so they have a way in.
      if (!existing.lastSignInAt) {
        const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
        if (pwError) {
          const friendly = friendlyPasswordError(pwError);
          if (friendly) return NextResponse.json({ error: friendly }, { status: 400 });
          throw new Error(pwError.message);
        }
        return NextResponse.json({
          id: existing.id,
          welcomeEmailSent: await welcome(existing.email, name.trim()),
          note: "They were already set up on the app but had never logged in, so their password is now the one above. Their client record is unchanged.",
        });
      }
      return NextResponse.json({
        id: existing.id,
        welcomeEmailSent: await welcome(existing.email, name.trim()),
        note: "They already use the app, so their client record is unchanged and they log in with their own existing password, not the one above.",
      });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), role: "coach" },
    });
    if (error) {
      const friendly = friendlyPasswordError(error);
      if (friendly) return NextResponse.json({ error: friendly }, { status: 400 });
      throw new Error(error.message);
    }

    return NextResponse.json({ id: data.user.id, welcomeEmailSent: await welcome(email.trim(), name.trim()) });
  } catch (err) {
    console.error("create coach failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
