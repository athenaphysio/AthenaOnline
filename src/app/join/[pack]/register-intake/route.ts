import { joinRedirect } from "@/lib/joinLink";

// A brand's registration link that carries straight on to the Programme
// intake form, for example /join/concussion/register-intake: for a new client
// who should fill in both in one go.
export async function GET(req: Request, { params }: { params: Promise<{ pack: string }> }) {
  const { pack } = await params;
  return joinRedirect(req, pack, "/register?then=intake");
}
