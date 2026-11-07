import { NextRequest, NextResponse } from "next/server";
import { runTrainingAction } from "@/lib/trainingDataActions";

// Dr David Silver PhD's changes to a client's training data, tests and
// goals. The clinic login is checked before any /api/clinic route runs.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const out = await runTrainingAction(id, "clinician", body);
  return NextResponse.json(out.body, { status: out.status });
}
