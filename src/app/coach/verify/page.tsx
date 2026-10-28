import { redirect } from "next/navigation";
import { getCoachLogin, getCoach } from "@/lib/coachAuth";
import VerifyForm from "./VerifyForm";

export default async function CoachVerifyPage() {
  const login = await getCoachLogin();
  if (!login) redirect("/coach/login");
  if (await getCoach()) redirect("/coach");
  return <VerifyForm name={login.name} />;
}
