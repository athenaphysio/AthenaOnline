import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClientRecordShell from "../ClientRecordShell";
import styles from "../dashboard/ClientDashboard.module.css";
import MessageThreadPanel from "../dashboard/MessageThreadPanel";
import TierBadgeIcon from "@/components/TierBadgeIcon";
import { getPatientMembership } from "@/lib/membership";
import { getMembershipTier } from "@/lib/membershipTiers";
import { resolveBrandPack } from "@/lib/brandPackResolve";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: patient }, membership, brand] = await Promise.all([
    supabaseAdmin.from("patients").select("first_name").eq("id", id).maybeSingle<{ first_name: string }>(),
    getPatientMembership(id),
    resolveBrandPack({ patientId: id }).catch(() => null),
  ]);
  // Messaging that comes with the client's package, set on their brand pack.
  const included = brand && !brand.isAllDefault && brand.app_layout.messaging_included ? brand.name : null;
  const tier = membership.tier !== "none" ? getMembershipTier(membership.tier) : null;

  return (
    <ClientRecordShell patientId={id} active="messages">
      <div className={`${styles.card} ${styles.messagesPanel}`}>
        <div className={styles.messagesHead}>
          <span className={`${styles.badge} ${styles.badgeTier}`}>
            {included ? (
              `Messaging included with ${included}`
            ) : tier ? (
              <>
                Unlimited messaging · <TierBadgeIcon size={12} />
                {tier.name} tier
              </>
            ) : (
              "One free message per programme"
            )}
          </span>
        </div>
        <MessageThreadPanel patientId={id} patientFirstName={patient?.first_name ?? ""} />
      </div>
    </ClientRecordShell>
  );
}
