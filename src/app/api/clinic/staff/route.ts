import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { friendlyPasswordError, passwordMeetsRules, PASSWORD_MIN_LENGTH } from "@/lib/passwordRules";

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

    return NextResponse.json({ id: data.user.id });
  } catch (err) {
    console.error("create coach failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
