import { redirect } from "next/navigation";
import { getCoachLogin, getCoach } from "@/lib/coachAuth";
import { coachNext } from "@/lib/safeNext";
import VerifyForm from "./VerifyForm";

export default async function CoachVerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = coachNext((await searchParams).next);
  const login = await getCoachLogin();
  if (!login) redirect(next === "/coach" ? "/coach/login" : `/coach/login?next=${encodeURIComponent(next)}`);
  if (await getCoach()) redirect(next);
  return <VerifyForm name={login.name} next={next} />;
}
