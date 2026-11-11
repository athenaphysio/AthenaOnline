import type { Metadata } from "next";
import { loadPlanner, patientForToken, touchLink } from "@/lib/diaryServer";
import DiaryPlanner from "@/components/diary/DiaryPlanner";
import styles from "../../session/TodaySession.module.css";

export const metadata: Metadata = {
  title: "Practice planner",
  robots: { index: false, follow: false },
};

// The page a PA opens from the link their executive shared. It shows only
// what is needed to place sessions in the diary: how many practices there
// are this week and next, and the slots already chosen. No programme
// content, no clinical detail, no messages.
export default async function PaPlannerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await patientForToken(token);

  if (!link) {
    return (
      <div className={styles.app}>
        <div className={styles.inner}>
          <div className={styles.head}>
            <h1>Practice planner</h1>
            <p>This planner link is no longer active. If you still need it, ask for a new one to be shared with you.</p>
          </div>
        </div>
      </div>
    );
  }

  await touchLink(link.linkId);
  const data = await loadPlanner(link.patientId, "pa");
  const name = data.firstName || "your executive";

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <h1>Planning {data.firstName ? `${data.firstName}'s` : "the"} practice</h1>
          <p>
            Hello {link.paName}. {name} works with Dr David Silver PhD, and this is where you can fit their practice sessions around
            their diary. For each session, choose a day, a start time, how long they will have, and where they will be. The session
            adjusts to the time available, so a twenty minute gap is still worth placing.
          </p>
          <p>
            {data.google.connected
              ? `Each slot you save appears in the Athena Training calendar in ${name}'s Google Calendar.`
              : `${name} hasn't linked Google Calendar yet, so slots are saved in the app only for now.`}
          </p>
        </div>
        <div style={{ padding: "8px 22px 40px" }}>
          <DiaryPlanner initial={data} endpoint={`/api/planner/${token}`} />
        </div>
      </div>
    </div>
  );
}
