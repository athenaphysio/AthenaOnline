import { NextRequest, NextResponse } from "next/server";
import { getAppAssetUrl } from "@/lib/appAssets";

// Public and read-only, deliberately outside /api/clinic -- both a coach
// viewing a cardio block in Vault and a patient viewing one in their own
// session need this (e.g. the PM5 button-key image), and neither the
// clinic cookie gate nor the patient auth gate should stand in the way of
// what's just a small reference image, not patient data.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const url = await getAppAssetUrl(key);
  return NextResponse.json({ url });
}
