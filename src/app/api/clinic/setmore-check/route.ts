import { NextResponse } from "next/server";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { checkSetmore } from "@/lib/setmore";

// Open this address while logged in to the clinic to see, in plain words,
// whether the app is connected to Setmore. Creates nothing.
export async function GET() {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Log in to the clinic first." }, { status: 401 });
  const result = await checkSetmore();
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Setmore check</title>
<body style="font-family:-apple-system,Helvetica,Arial,sans-serif;background:#F2EDE4;color:#1C1C1C;padding:40px 20px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px 30px;border-top:4px solid ${result.ok ? "#3f7a4e" : "#9B1C1C"}">
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:24px;margin:0 0 12px">${result.ok ? "Setmore is connected" : "Setmore is not connected yet"}</h1>
<p style="font-size:15px;line-height:1.6;margin:0">${result.message.replace(/</g, "&lt;")}</p></div></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
