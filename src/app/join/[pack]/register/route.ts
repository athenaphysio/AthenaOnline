import { joinRedirect } from "@/lib/joinLink";

// A brand's registration link, for example /join/concussion/register: the
// one form every new client fills in, in their brand from the start. After
// it, "Set up my app login" opens their brand's login page.
export async function GET(req: Request, { params }: { params: Promise<{ pack: string }> }) {
  const { pack } = await params;
  return joinRedirect(req, pack, "/register");
}
