import "server-only";
import { createClient } from "@supabase/supabase-js";

// Full-access client using the service_role key. Server-only — never import
// this from a Client Component or anything that ships to the browser. Used
// exclusively inside the password-gated /api/clinic/* routes to upload audio
// and write rows that the public anon key is deliberately not allowed to.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
