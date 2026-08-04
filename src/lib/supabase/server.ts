import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Patient-auth server client, for Server Components and Route Handlers that
// need to know which patient is logged in. Reads run under that patient's
// own auth token, so the RLS policies on programmes/programme_items/
// programme_item_weeks apply -- this is what actually protects the data.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render; middleware refreshes
            // the session cookie instead, so this is safe to ignore.
          }
        },
      },
    }
  );
}
