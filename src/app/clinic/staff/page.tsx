import Image from "next/image";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../clinic.module.css";

// See the matching comment on src/app/clinic/page.tsx -- this page has no
// dynamic API to trigger dynamic rendering automatically, so without this
// it would freeze at whatever the staff list looked like at build time.
export const dynamic = "force-dynamic";
import StaffManager, { type Coach, type TemplateOption, type Assignment } from "./StaffManager";
import ClinicBrandbar from "../ClinicBrandbar";

export default async function StaffPage() {
  const [{ data: coaches }, { data: templates }, { data: assignments }] = await Promise.all([
    supabaseAdmin
      .from("staff")
      .select("id, name, email, created_at")
      .eq("role", "coach")
      .order("created_at", { ascending: false })
      .returns<Coach[]>(),
    supabaseAdmin.from("programme_templates").select("id, name").order("name").returns<TemplateOption[]>(),
    supabaseAdmin.from("coach_template_assignments").select("coach_id, template_id").returns<Assignment[]>(),
  ]);

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Staff</h1>
        <p className={styles.subheading}>
          Create Coach accounts and choose which Programme Templates each one can see.{" "}
          <Link href="/clinic/programme-templates" className={styles.canvasLink}>
            Programme Templates
          </Link>
        </p>

        <StaffManager initialCoaches={coaches ?? []} templates={templates ?? []} initialAssignments={assignments ?? []} />
      </div>
    </div>
  );
}
