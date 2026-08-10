import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import clinicStyles from "../../clinic.module.css";
import ClinicBrandbar from "../../ClinicBrandbar";
import EquipmentManagerClient, { type EquipmentRow } from "./EquipmentManagerClient";

// Same reasoning as the other Vault pages -- no dynamic API of its own, so
// without this the list would freeze at whatever equipment looked like at
// build time.
export const dynamic = "force-dynamic";

export default async function VaultEquipmentPage() {
  const { data, error } = await supabaseAdmin
    .from("equipment")
    .select("id, name, icon_url")
    .order("name")
    .returns<EquipmentRow[]>();

  if (error) {
    throw new Error(`Equipment list query failed: ${error.message}`);
  }

  return (
    <div className={clinicStyles.app}>
      <div className={clinicStyles.inner}>
        <ClinicBrandbar />

        <h1 className={clinicStyles.heading}>Equipment icons</h1>
        <p className={clinicStyles.subheading}>
          Upload or replace the icon for each equipment item, used to tag exercises in the Vault.{" "}
          <Link href="/clinic/vault" className={clinicStyles.canvasLink}>
            ← Vault
          </Link>
        </p>

        <EquipmentManagerClient equipment={data ?? []} />
      </div>
    </div>
  );
}
