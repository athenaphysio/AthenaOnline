import { joinRedirect } from "@/lib/joinLink";

// A brand's own link to the app, for example /join/concussion: marks this
// phone as that brand's and opens its login page. See src/lib/joinLink.ts.
export async function GET(req: Request, { params }: { params: Promise<{ pack: string }> }) {
  const { pack } = await params;
  return joinRedirect(req, pack, "/start");
}
