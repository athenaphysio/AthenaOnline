import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../ClinicBrandbar";
import styles from "./ClinicMessagesInbox.module.css";
import { getMembershipTier } from "@/lib/membershipTiers";
import TierBadgeIcon from "@/components/TierBadgeIcon";
import { MESSAGE_LIMIT_NOTICE } from "@/lib/messaging";
import { awaitingReplyHours, replyGapsHours, averageReplyHoursSince, type InboxMessage } from "@/lib/messagingInbox";

type PatientRow = { id: string; first_name: string; last_name: string | null };
type MembershipRow = { patient_id: string; tier: string; status: string; billing_type: string; expires_at: string | null };
type GateEventRow = { id: string; patient_id: string; sent_at: string };

type FilterKey = "all" | "unread" | "awaiting" | "gated";

function isMembershipActive(m: MembershipRow | undefined): boolean {
  if (!m || m.status !== "active") return false;
  if (m.billing_type === "prepay" && m.expires_at) return new Date(m.expires_at) >= new Date();
  return true;
}

function formatRelative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

export default async function ClinicMessagesInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter: FilterKey = (["all", "unread", "awaiting", "gated"] as const).includes(rawFilter as FilterKey)
    ? (rawFilter as FilterKey)
    : "all";

  const [{ data: patients }, { data: messages }, { data: memberships }, { data: gateEvents }] = await Promise.all([
    supabaseAdmin.from("patients").select("id, first_name, last_name").returns<PatientRow[]>(),
    supabaseAdmin
      .from("patient_messages")
      .select("id, patient_id, sender, body, created_at, read_at")
      .order("created_at", { ascending: true })
      .returns<InboxMessage[]>(),
    supabaseAdmin.from("patient_memberships").select("patient_id, tier, status, billing_type, expires_at").returns<MembershipRow[]>(),
    supabaseAdmin
      .from("communications")
      .select("id, patient_id, sent_at")
      .eq("type", "message_limit_reached")
      .order("sent_at", { ascending: true })
      .returns<GateEventRow[]>(),
  ]);

  const patientsById = new Map((patients ?? []).map((p) => [p.id, p]));
  const membershipByPatient = new Map((memberships ?? []).map((m) => [m.patient_id, m]));

  const messagesByPatient = new Map<string, InboxMessage[]>();
  for (const m of messages ?? []) {
    if (!messagesByPatient.has(m.patient_id)) messagesByPatient.set(m.patient_id, []);
    messagesByPatient.get(m.patient_id)!.push(m);
  }

  const gateEventsByPatient = new Map<string, GateEventRow[]>();
  for (const g of gateEvents ?? []) {
    if (!gateEventsByPatient.has(g.patient_id)) gateEventsByPatient.set(g.patient_id, []);
    gateEventsByPatient.get(g.patient_id)!.push(g);
  }

  // Every patient reply-gap across every thread, computed once -- feeds
  // both the 7-day average and its "vs last week" comparison.
  const allGaps = Array.from(messagesByPatient.values()).flatMap((thread) => replyGapsHours(thread));
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const avgReply7d = averageReplyHoursSince(allGaps, sevenDaysAgo);
  const avgReplyPrior7d = averageReplyHoursSince(allGaps, fourteenDaysAgo, sevenDaysAgo);

  const patientIds = new Set([...messagesByPatient.keys(), ...gateEventsByPatient.keys()]);

  type Row = {
    patientId: string;
    name: string;
    initials: string;
    lastAt: string;
    snippet: string;
    unreadCount: number;
    isGated: boolean;
    awaitingHours: number | null;
    tierLabel: string;
    tierActive: boolean;
  };

  const rows: Row[] = [];
  for (const patientId of patientIds) {
    const patient = patientsById.get(patientId);
    if (!patient) continue;
    const thread = messagesByPatient.get(patientId) ?? [];
    const gates = gateEventsByPatient.get(patientId) ?? [];
    const lastMessage = thread[thread.length - 1];
    const lastGate = gates[gates.length - 1];

    const lastMessageAt = lastMessage ? new Date(lastMessage.created_at).getTime() : 0;
    const lastGateAt = lastGate ? new Date(lastGate.sent_at).getTime() : 0;
    const isGated = lastGateAt > lastMessageAt;

    const name = `${patient.first_name}${patient.last_name ? ` ${patient.last_name}` : ""}`;
    const initials = `${patient.first_name.charAt(0)}${patient.last_name ? patient.last_name.charAt(0) : ""}`.toUpperCase();
    const membership = membershipByPatient.get(patientId);
    const tierActive = isMembershipActive(membership);
    const tierLabel = tierActive ? (getMembershipTier(membership!.tier)?.name ?? membership!.tier) : "Standard";

    rows.push({
      patientId,
      name,
      initials,
      lastAt: isGated ? lastGate.sent_at : lastMessage.created_at,
      snippet: isGated
        ? `System: ${MESSAGE_LIMIT_NOTICE}`
        : lastMessage.sender === "clinician"
          ? `You: ${lastMessage.body}`
          : lastMessage.body,
      unreadCount: thread.filter((m) => m.sender === "patient" && !m.read_at).length,
      isGated,
      awaitingHours: awaitingReplyHours(thread),
      tierLabel,
      tierActive,
    });
  }

  rows.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

  const unreadRows = rows.filter((r) => r.unreadCount > 0);
  const awaitingRows = rows.filter((r) => r.awaitingHours != null && r.awaitingHours >= 24);
  const gatedRows7d = rows.filter((r) => r.isGated); // per-row "most recent event was a gate"

  const unreadTotal = unreadRows.reduce((sum, r) => sum + r.unreadCount, 0);
  const oldestAwaitingHours = awaitingRows.length > 0 ? Math.max(...awaitingRows.map((r) => r.awaitingHours!)) : null;

  const gatedPatientsThisWeek = new Set(
    Array.from(gateEventsByPatient.entries())
      .filter(([, events]) => events.some((e) => new Date(e.sent_at) >= sevenDaysAgo))
      .map(([patientId]) => patientId)
  );

  const filteredRows =
    filter === "unread"
      ? unreadRows
      : filter === "awaiting"
        ? awaitingRows
        : filter === "gated"
          ? gatedRows7d
          : rows;

  const FILTERS: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: rows.length },
    { key: "unread", label: "Unread", count: unreadRows.length },
    { key: "awaiting", label: "Awaiting reply", count: awaitingRows.length },
    { key: "gated", label: "Free-message triggered", count: gatedRows7d.length },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <ClinicBrandbar />

        <div className={styles.topbar}>
          <div>
            <h1>Messages</h1>
            <div className={styles.sub}>All conversations across your active clients</div>
          </div>
        </div>

        {/* Compose message (mockup) isn't wired -- there's no "start a
            conversation from scratch" flow anywhere in the app; every real
            thread starts from the patient's own free message or a paid
            tier's messaging, not from David initiating cold. Omitted
            rather than linked to something that doesn't exist. */}

        <div className={styles.metricGrid}>
          <div className={`${styles.card} ${styles.metric}`}>
            <span className={styles.label}>Unread</span>
            <div className={styles.num}>{unreadTotal}</div>
            <div className={styles.note}>across {unreadRows.length} client{unreadRows.length === 1 ? "" : "s"}</div>
          </div>
          <div className={`${styles.card} ${styles.metric} ${awaitingRows.length > 0 ? styles.metricFlag : ""}`}>
            <span className={styles.label}>Awaiting your reply &gt;24h</span>
            <div className={styles.num}>{awaitingRows.length}</div>
            <div className={styles.note}>
              {oldestAwaitingHours != null ? `oldest: ${Math.round(oldestAwaitingHours)} hours` : "none waiting"}
            </div>
          </div>
          <div className={`${styles.card} ${styles.metric} ${gatedPatientsThisWeek.size > 0 ? styles.metricFlag : ""}`}>
            <span className={styles.label}>Hit free-message limit this week</span>
            <div className={styles.num}>{gatedPatientsThisWeek.size}</div>
            <div className={styles.note}>potential membership prompts</div>
          </div>
          <div className={`${styles.card} ${styles.metric}`}>
            <span className={styles.label}>Avg. reply time (7d)</span>
            <div className={styles.num}>{avgReply7d != null ? `${avgReply7d.toFixed(1)}h` : "N/A"}</div>
            <div className={styles.note}>
              {avgReply7d != null && avgReplyPrior7d != null
                ? `${avgReply7d <= avgReplyPrior7d ? "down" : "up"} from ${avgReplyPrior7d.toFixed(1)}h last week`
                : "not enough data yet"}
            </div>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.filters}>
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === "all" ? "/clinic/messages" : `/clinic/messages?filter=${f.key}`}
                className={`${styles.filter} ${filter === f.key ? styles.filterActive : ""}`}
              >
                {f.label} ({f.count})
              </Link>
            ))}
          </div>
        </div>

        <div className={`${styles.card} ${styles.inbox}`}>
          {filteredRows.length === 0 ? (
            <div className={styles.emptyState}>Nothing here.</div>
          ) : (
            filteredRows.map((r) => (
              <Link
                key={r.patientId}
                href={`/clinic/patients/${r.patientId}/dashboard#messages`}
                className={`${styles.row} ${r.unreadCount > 0 ? styles.rowUnread : ""}`}
              >
                <div className={styles.avatar}>{r.initials}</div>
                <div className={styles.rowMain}>
                  <div className={styles.rowTop}>
                    {r.unreadCount > 0 && <span className={styles.unreadDot} />}
                    <span className={styles.rowName}>{r.name}</span>
                  </div>
                  <div className={styles.rowSnippet}>{r.snippet}</div>
                </div>
                <div className={styles.rowTags}>
                  {r.isGated && <span className={`${styles.tag} ${styles.tagGated}`}>Free message used</span>}
                  <span className={`${styles.tag} ${r.tierActive ? styles.tagTier : ""}`}>
                    {r.tierActive && <TierBadgeIcon size={14} />}
                    {r.tierLabel}
                  </span>
                </div>
                <div className={styles.rowTime}>{formatRelative(r.lastAt)}</div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
