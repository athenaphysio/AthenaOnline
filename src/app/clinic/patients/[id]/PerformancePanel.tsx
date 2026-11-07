import clinicStyles from "../../clinic.module.css";
import { loadPerformance } from "@/lib/performanceMetricsServer";
import PerformanceMetricsCard from "@/components/performance/PerformanceMetricsCard";

// The client's Performance metrics card, as Dr David Silver PhD sees it:
// the same goals, graphs and tests, with goal setting and test editing.
export default async function PerformancePanel({ patientId, firstName }: { patientId: string; firstName: string }) {
  const data = await loadPerformance(patientId);
  return (
    <PerformanceMetricsCard
      data={data}
      viewer="clinician"
      endpoint={`/api/clinic/patients/${patientId}/training-data`}
      firstName={firstName}
      cardClass={clinicStyles.card}
      titleClass={clinicStyles.cardTitle}
      buttonClass={clinicStyles.button}
    />
  );
}
