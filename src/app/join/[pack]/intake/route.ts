import { joinRedirect } from "@/lib/joinLink";

// A brand's Programme intake form link, for example /join/concussion/intake:
// for a client who has already registered. No login is needed; their answers
// are matched to their record by email.
export async function GET(req: Request, { params }: { params: Promise<{ pack: string }> }) {
  const { pack } = await params;
  return joinRedirect(req, pack, "/intake");
}
