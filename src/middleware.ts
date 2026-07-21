import { NextRequest, NextResponse } from "next/server";
import { CLINIC_SESSION_COOKIE, getExpectedSessionToken } from "@/lib/clinicAuth";

export async function middleware(request: NextRequest) {
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

export const config = {
  matcher: ["/clinic/:path*", "/api/clinic/:path*"],
};
