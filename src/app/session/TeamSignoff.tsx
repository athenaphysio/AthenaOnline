import type { AppLayout } from "@/lib/appLayout";
import styles from "./screens/Screens.module.css";

// The sign-off at the foot of the home page for a pack signed by its team:
// the team's name and the people in it, as set on the brand pack.
export default function TeamSignoff({ layout }: { layout: AppLayout }) {
  if (!layout.team_name && layout.team.length === 0) return null;
  return (
    <div className={styles.signoff}>
      <p className={styles.signoffTeam}>{layout.team_name || "Your team"}</p>
      {layout.team.length > 0 && <p className={styles.signoffNames}>{layout.team.map((m) => m.name).join(", ")}</p>}
    </div>
  );
}
