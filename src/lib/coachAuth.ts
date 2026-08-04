import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CoachIdentity = { id: string; name: string; email: string };

// Returns the logged-in coach's identity, or null if there isn't one --
// use this in API routes, where you want to return a 401 yourself rather
// than redirect.
export async function getCoach(): Promise<CoachIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("id, name, email, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!staff || staff.role !== "coach") return null;

  return { id: staff.id, name: staff.name, email: staff.email };
}

// For Server Components: redirects to /coach/login if there's no valid
// coach session. This is app-level defense in depth, not the actual
// security boundary -- that's Row Level Security (0016_coach_rls.sql).
// Even if this check were skipped entirely, a coach's own Supabase client
// still couldn't read anything RLS doesn't allow.
export async function requireCoach(): Promise<CoachIdentity> {
  const coach = await getCoach();
  if (!coach) redirect("/coach/login");
  return coach;
}
