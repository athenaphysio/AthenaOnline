import Link from "next/link";
import { notFound } from "next/navigation";
import clinicStyles from "../../../clinic.module.css";
import ClinicBrandbar from "../../../ClinicBrandbar";
import { loadClinicPassport } from "@/lib/passportServer";
import PassportClinicPanel from "./PassportClinicPanel";

// The care team's view of one client's Human Passport: switch it on, upload
// results through the template, add a note to each result and release it.
// Everything uploaded starts as a draft the client cannot see.
export default async function ClinicPassportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { results, markers, patient } = await loadClinicPassport(id);
  if (!patient) notFound();
  const name = [patient.first_name, patient.last_name].filter(Boolean).join(" ") || "This client";

  return (
    <div className={clinicStyles.app}>
      <div className={clinicStyles.inner} style={{ maxWidth: 980 }}>
        <ClinicBrandbar />
        <h1 className={clinicStyles.heading}>Human Passport: {name}</h1>
        <p className={clinicStyles.subheading}>
          Upload results through the template, add a short note to each one, then release it. Nothing appears on the
          client&apos;s My Passport until it has been released.{" "}
          <Link href={`/clinic/patients/${id}`} style={{ color: "var(--clinic-on-canvas)" }}>
            Back to the client record
          </Link>
        </p>
        <PassportClinicPanel
          patientId={id}
          clientName={patient.first_name ?? "the client"}
          initialEnabled={patient.passport_enabled}
          markers={markers}
          results={results}
        />
      </div>
    </div>
  );
}
