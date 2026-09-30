import type { AthenaPlanV1, PlanSession } from "@/lib/athenaPlan";
import clinicStyles from "../../../clinic.module.css";

const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
  any: "Any day",
};

const TYPE_LABELS: Record<string, string> = {
  run: "Run",
  bike: "Bike",
  swim: "Swim",
  strength: "Strength",
  rest: "Rest",
  other: "Other",
};

function SessionCard({ session }: { session: PlanSession }) {
  return (
    <div style={{ border: "1px solid var(--cream)", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{session.title}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          {DAY_LABELS[session.day] ?? session.day} · {TYPE_LABELS[session.type] ?? session.type}
        </div>
      </div>

      {session.type === "strength" ? (
        <p style={{ fontSize: 13.5, color: "var(--stone)", marginTop: 6, marginBottom: 0 }}>
          Your strength session. Links to your existing strength programme in the app.
        </p>
      ) : (
        <>
          {session.summary && <p style={{ fontSize: 13.5, marginTop: 6, marginBottom: 6 }}>{session.summary}</p>}
          {session.steps.length > 0 && (
            <ul style={{ margin: "0 0 6px", paddingLeft: 18, fontSize: 13 }}>
              {session.steps.map((step, i) => (
                <li key={i} style={{ marginBottom: 2 }}>
                  {step.label ? <strong>{step.label}: </strong> : null}
                  {step.detail}
                </li>
              ))}
            </ul>
          )}
          {(session.target || session.total) && (
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "4px 0" }}>
              {session.target}
              {session.target && session.total ? " · " : ""}
              {session.total}
            </p>
          )}
          {session.notes && <p style={{ fontSize: 12.5, color: "var(--stone)", margin: "4px 0 0" }}>{session.notes}</p>}
        </>
      )}
    </div>
  );
}

// The plan rendered plainly, week by week -- shown exactly as written,
// nothing added, nothing reworded. Used both for David's review before
// Assign and, unchanged, as the shape the client-facing calendar (Step 3)
// will read from.
export default function PlanPreview({ plan }: { plan: AthenaPlanV1 }) {
  return (
    <div>
      <div className={clinicStyles.card}>
        <div className={clinicStyles.cardTitle}>{plan.block_title}</div>
        {plan.intro && (
          <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
            {plan.intro}
          </p>
        )}
        <p className={clinicStyles.notice} style={{ marginTop: 0, marginBottom: 0 }}>
          Starts {plan.start_date}
        </p>
      </div>

      {plan.weeks.map((week) => (
        <div key={week.week} className={clinicStyles.card}>
          <div className={clinicStyles.cardTitle}>
            Week {week.week}
            {week.label ? `, ${week.label}` : ""}
          </div>
          {week.focus && (
            <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
              {week.focus}
            </p>
          )}
          {[...week.sessions]
            .sort((a, b) => a.order - b.order)
            .map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
        </div>
      ))}

      <div className={clinicStyles.card}>
        <div className={clinicStyles.cardTitle}>Moving on</div>
        <p style={{ fontSize: 13.5, margin: 0 }}>{plan.rules.move_on}</p>
      </div>
      <div className={clinicStyles.card}>
        <div className={clinicStyles.cardTitle}>If you have a flare-up</div>
        <p style={{ fontSize: 13.5, margin: 0 }}>{plan.rules.flare}</p>
      </div>
    </div>
  );
}
