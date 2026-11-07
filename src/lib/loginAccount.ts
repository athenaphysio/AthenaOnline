import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// One login can carry both a coach role (a public.staff row) and a client
// role (a public.patients row), sharing the same id, email and password.
// This finds an existing login by email so a second role can be added to it
// rather than refused as "already registered" (0135_find_login_account.sql).
export type LoginAccount = { id: string; email: string; lastSignInAt: string | null };

export async function findLoginAccount(email: string): Promise<LoginAccount | null> {
  const { data, error } = await supabaseAdmin.rpc("find_login_account", { p_email: email.trim().toLowerCase() });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; email: string; last_sign_in_at: string | null }[];
  const row = rows[0];
  return row ? { id: row.id, email: row.email, lastSignInAt: row.last_sign_in_at } : null;
}
