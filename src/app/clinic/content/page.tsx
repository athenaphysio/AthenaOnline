import { redirect } from "next/navigation";

// The 11-tile hub this page used to render is gone -- every content type
// it linked to now has its own row in the persistent left nav (see the
// Phase 2 brief and ClinicSidebar.tsx), so there's nothing left for this
// route to do except send anyone with an old link or bookmark somewhere
// real. /clinic/content/email-templates is a separate nested route and is
// untouched by this redirect.
export default function ContentHubPage() {
  redirect("/clinic/workouts");
}
