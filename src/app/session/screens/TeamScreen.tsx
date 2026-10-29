import ClientShell from "../ClientShell";
import type { ClientAppContext } from "@/lib/clientApp";
import styles from "./Screens.module.css";

function initialsOf(name: string): string {
  const words = name
    .replace(/\b(Dr|Prof|Professor|PhD|Mr|Mrs|Ms)\b\.?/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

// Meet your team: the people named on the client's brand pack.
export default function TeamScreen({ ctx }: { ctx: ClientAppContext }) {
  const { team, team_name } = ctx.layout;
  return (
    <ClientShell
      ctx={ctx}
      active="team"
      title="Meet your team"
      lead={team_name ? `${team_name}, and what each person does for you.` : "The people looking after you, and what each of them does."}
    >
      <div className={styles.stack}>
        {team.length === 0 && (
          <div className={styles.card}>
            <p className={styles.muted}>Your team will appear here shortly.</p>
          </div>
        )}
        {team.map((m) => (
          <div key={m.name} className={`${styles.card} ${styles.member}`}>
            <div className={styles.initials} aria-hidden="true">
              {initialsOf(m.name)}
            </div>
            <div>
              <h2 className={styles.cardTitle}>{m.name}</h2>
              {m.role && <p className={styles.role}>{m.role}</p>}
              {m.about && <p className={styles.muted}>{m.about}</p>}
            </div>
          </div>
        ))}
      </div>
    </ClientShell>
  );
}
