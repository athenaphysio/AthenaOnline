import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { CLINIC_SESSION_COOKIE, getExpectedSessionToken } from "@/lib/clinicAuth";

export async function middleware(request: NextRequest) {
  // /coach/* shares the exact same Supabase-Auth session-refresh mechanism
  // as the patient side -- it's a different identity (staff vs patients),
  // not a different auth system. Whether a given /coach/* request is
  // genuinely a coach (vs some other logged-in Supabase user) is enforced
  // by requireCoach() in the page/route itself, and ultimately by RLS.
  if (
    request.nextUrl.pathname.startsWith("/start") ||
    request.nextUrl.pathname.startsWith("/session") ||
    request.nextUrl.pathname.startsWith("/shop") ||
    request.nextUrl.pathname.startsWith("/membership") ||
    request.nextUrl.pathname.startsWith("/about") ||
    request.nextUrl.pathname.startsWith("/equipment") ||
    request.nextUrl.pathname.startsWith("/book") ||
    request.nextUrl.pathname.startsWith("/coach") ||
    request.nextUrl.pathname.startsWith("/api/coach") ||
    request.nextUrl.pathname.startsWith("/api/session") ||
    request.nextUrl.pathname.startsWith("/api/shop") ||
    request.nextUrl.pathname.startsWith("/api/membership")
  ) {
    return refreshPatientSession(request);
  }

  if (
    request.nextUrl.pathname.startsWith("/clinic/login") ||
    request.nextUrl.pathname.startsWith("/api/clinic/login")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(CLINIC_SESSION_COOKIE)?.value;
  const expected = await getExpectedSessionToken();

  if (token && token === expected) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/clinic/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

// Patient auth tokens expire and need refreshing on the way in, before a
// Server Component ever tries to read the (still-valid-looking) cookie.
async function refreshPatientSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/clinic/:path*",
    "/api/clinic/:path*",
    "/start",
    "/session/:path*",
    "/shop/:path*",
    "/membership/:path*",
    "/about/:path*",
    "/equipment/:path*",
    "/book/:path*",
    "/coach/:path*",
    "/api/coach/:path*",
    "/api/session/:path*",
    "/api/shop/:path*",
    "/api/membership/:path*",
  ],
};
