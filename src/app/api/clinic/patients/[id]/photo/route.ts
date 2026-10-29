import { NextRequest, NextResponse } from "next/server";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { photoLink, setClientPhoto } from "@/lib/clientPhoto";

// The clinic adds, changes or removes a client's headshot. The browser
// sends it already resized, as a JPEG data URL.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { photo } = (await request.json()) as { photo?: string };
  if (!photo) return NextResponse.json({ error: "No photo was sent." }, { status: 400 });
  try {
    const path = await setClientPhoto(id, photo);
    return NextResponse.json({ url: await photoLink(path) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save that photo." }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await setClientPhoto(id, null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not remove the photo." }, { status: 500 });
  }
}
