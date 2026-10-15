import "server-only";
import { cookies } from "next/headers";
import { CLINIC_SESSION_COOKIE, getExpectedSessionToken } from "@/lib/clinicAuth";

// The middleware already keeps every /api/clinic request behind David's
// login. This repeats the same check inside a route, so an action that lets
// someone in (or sends an email) is protected even if the middleware matcher
// were ever changed.
export async function isClinicAdminRequest(): Promise<boolean> {
  const token = (await cookies()).get(CLINIC_SESSION_COOKIE)?.value;
  if (!token) return false;
  return token === (await getExpectedSessionToken());
}
