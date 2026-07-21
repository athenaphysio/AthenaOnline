import { NextRequest, NextResponse } from "next/server";
import { CLINIC_SESSION_COOKIE, getExpectedSessionToken } from "@/lib/clinicAuth";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") || "/clinic/new");

  if (password !== process.env.CLINIC_PASSWORD) {
    const url = new URL("/clinic/login", request.url);
    url.searchParams.set("error", "1");
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const token = await getExpectedSessionToken();
  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(CLINIC_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
