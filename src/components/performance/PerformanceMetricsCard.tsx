import { performanceType, formatSeconds } from "@/lib/performanceTypes";
import { STATUS_WORDS, ZONES, type Status } from "@/lib/performanceMetrics";
import type { PerformanceData } from "@/lib/performanceMetricsServer";
import GoalChartSvg from "./GoalChartSvg";
import LoadChartSvg from "./LoadChartSvg";
import GoalEditor from "./GoalEditor";
import TestResultForm from "@/components/training/TestResultForm";
import ConfirmRemove from "@/components/training/ConfirmRemove";
import CopyTestButton from "./CopyTestButton";

// Performance metrics: one headline per goal, a graph per goal, weekly
// running against plan, and every test, newest first. The client sees it
// on Me; Dr David Silver PhD sees the same card on their page, with the
// goal and test editing that is his alone.

const TONE: Record<Status, string> = { on_track: "#008300", ahead: "#2a78d6", behind: "#c98500", reached: "#008300", none: "#8a8a8a" };

function day(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function Label({ status, viewer }: { status: Status; viewer: "client" | "clinician" }) {
  const words = STATUS_WORDS[viewer][status];
  if (!words) return null;
  return (
    <span style={{ display: "inline-block", fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 10, border: `1.5px solid ${TONE[status]}`, color: "inherit", whiteSpace: "nowrap" }}>
      {words}
    </span>
  );
}

export default function PerformanceMetricsCard({
  data,
  viewer,
  endpoint,
  firstName,
  cardClass,
  titleClass,
  buttonClass,
}: {
  data: PerformanceData;
  viewer: "client" | "clinician";
  endpoint: string;
  firstName: string;
  cardClass: string;
  titleClass: string;
  buttonClass: string;
}) {
  const { goals, tests, charts, weeks, aboveRange, candidates } = data;
  const clinician = viewer === "clinician";
  const you = clinician ? firstName : "you";
  const muted = { fontSize: 13.5, lineHeight: 1.55, margin: 0, opacity: 0.8 } as const;
  const sub = { fontSize: 15, fontWeight: 600, margin: "4px 0 2px" } as const;

  return (
    <div className={cardClass}>
      <h2 className={titleClass} style={{ marginBottom: 6 }}>
        Performance metrics
      </h2>

      {clinician && aboveRange && (
        <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: "0 0 10px", padding: "8px 10px", borderLeft: "3px solid #c98500" }}>
          Running in the week of {day(aboveRange.weekStart)} was {aboveRange.loggedKm.toFixed(1)} km against {aboveRange.plannedKm?.toFixed(1)} km planned,
          above the {Math.round(ZONES.weeklyHigh * 100)}% range. Worth a look before the next block.
        </p>
      )}

      {goals.length === 0 ? (
        <p style={muted}>
          {clinician
            ? `No goals set for ${firstName} yet. Add one below and the graphs appear as tests come in.`
            : "Dr David Silver PhD will add your goals here, and your tests will show how you are moving towards them."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
          {charts.map((c) => (
            <div key={c.goalId} style={{ display: "flex", gap: 8, alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap" }}>
              <span style={{ fontSize: 14.5, lineHeight: 1.45 }}>
                <b>{c.title}</b>
                <br />
                {c.headline.text}
              </span>
              <Label status={c.headline.status} viewer={viewer} />
            </div>
          ))}
          {goals
            .filter((g) => !charts.some((c) => c.goalId === g.id))
            .map((g) => (
              <div key={g.id} style={{ fontSize: 14.5, lineHeight: 1.45 }}>
                <b>
                  {performanceType(g.goal_type)?.label ?? "Goal"}: {g.target_text}
                  {g.event_name ? ` at ${g.event_name}` : ""}
                </b>
                {g.goal_date ? `, ${day(g.goal_date)}` : ""}
              </div>
            ))}
        </div>
      )}

      {charts.map((c) => (
        <div key={c.goalId} style={{ marginTop: 14 }}>
          <div style={sub}>{c.question}</div>
          <p style={muted}>{c.title}</p>
          {c.points.length > 0 ? (
            <GoalChartSvg chart={c} />
          ) : (
            <p style={muted}>The graph starts with the first test.</p>
          )}
        </div>
      ))}

      {weeks.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={sub}>Am I building safely?</div>
          <p style={muted}>
            Running km each week against the plan. The shaded range is {Math.round(ZONES.weeklyLow * 100)}% to {Math.round(ZONES.weeklyHigh * 100)}% of the
            planned km, where load builds without asking too much too soon.
          </p>
          <LoadChartSvg weeks={weeks} />
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <div style={sub}>Tests and races</div>
        {candidates.length > 0 && (
          <div style={{ margin: "4px 0 8px", padding: "8px 10px", borderLeft: "3px solid #2a78d6", fontSize: 13.5, lineHeight: 1.5 }}>
            {candidates.length === 1 ? "A recent session looks like a test:" : "Recent sessions that look like tests:"}
            {candidates.map((c) => (
              <div key={c.rowingResultId}>
                {day(c.date)}, {c.words}. <CopyTestButton endpoint={endpoint} id={c.rowingResultId} />
              </div>
            ))}
          </div>
        )}
        {tests.length === 0 && <p style={muted}>No tests yet. When {you} {clinician ? "does" : "do"} one, add it here.</p>}
        {tests.map((t) => (
          <div key={t.id} style={{ padding: "8px 0", borderTop: "1px solid rgba(127,127,127,0.22)", fontSize: 14, lineHeight: 1.5 }}>
            <div>
              <b>{performanceType(t.test_type)?.label ?? "Test"}</b> {t.result_text}
              {t.is_race ? " (race)" : ""}, {day(t.tested_on)}
            </div>
            {(t.avg_split_seconds || t.stroke_rate || t.drag_factor) && (
              <div style={{ fontSize: 13 }}>
                {[
                  t.avg_split_seconds ? `${formatSeconds(Number(t.avg_split_seconds), true)} /500m` : null,
                  t.stroke_rate ? `rate ${t.stroke_rate}` : null,
                  t.drag_factor ? `drag ${t.drag_factor}` : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}
            {t.notes && <div style={{ fontSize: 13, fontStyle: "italic" }}>{t.notes}</div>}
            {clinician && (
              <details style={{ fontSize: 13 }}>
                <summary style={{ cursor: "pointer" }}>Change</summary>
                <div style={{ marginTop: 6 }}>
                  <TestResultForm
                    endpoint={endpoint}
                    buttonClass={buttonClass}
                    editId={t.id}
                    prefill={{
                      tested_on: t.tested_on,
                      test_type: t.test_type,
                      result_text: t.result_text,
                      distance_m: t.distance_m,
                      split_text: t.avg_split_seconds ? formatSeconds(Number(t.avg_split_seconds), true) : "",
                      stroke_rate: t.stroke_rate,
                      drag_factor: t.drag_factor,
                      is_race: t.is_race,
                      notes: t.notes,
                    }}
                  />
                </div>
              </details>
            )}
            {(clinician || t.added_by === "client") && <ConfirmRemove endpoint={endpoint} body={{ action: "delete_test", id: t.id }} question="Remove this result?" />}
          </div>
        ))}
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Add a test</summary>
          <div style={{ marginTop: 8 }}>
            <TestResultForm endpoint={endpoint} buttonClass={buttonClass} />
          </div>
        </details>
      </div>

      {clinician && (
        <div style={{ marginTop: 16 }}>
          <div style={sub}>Goals</div>
          {goals.map((g) => (
            <div key={g.id} style={{ padding: "6px 0", borderTop: "1px solid rgba(127,127,127,0.22)", fontSize: 14 }}>
              {performanceType(g.goal_type)?.label}: {g.target_text}
              {g.event_name ? `, ${g.event_name}` : ""}
              {g.goal_date ? `, ${day(g.goal_date)}` : ""}
              <details style={{ fontSize: 13 }}>
                <summary style={{ cursor: "pointer" }}>Change</summary>
                <div style={{ marginTop: 6 }}>
                  <GoalEditor endpoint={endpoint} buttonClass={buttonClass} prefill={g} />
                </div>
              </details>
              <ConfirmRemove endpoint={endpoint} body={{ action: "delete_goal", id: g.id }} question="Remove this goal?" />
            </div>
          ))}
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Add a goal</summary>
            <div style={{ marginTop: 8 }}>
              <GoalEditor endpoint={endpoint} buttonClass={buttonClass} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
