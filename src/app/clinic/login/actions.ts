"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CLINIC_SESSION_COOKIE, getExpectedSessionToken } from "@/lib/clinicAuth";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") || "/clinic/new");

  if (password !== process.env.CLINIC_PASSWORD) {
    redirect(`/clinic/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const token = await getExpectedSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(CLINIC_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(next);
}
