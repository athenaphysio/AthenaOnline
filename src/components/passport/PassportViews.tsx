// The three levels of the Human Passport, as plain presentational pieces.
// They take data in and draw it, with no database calls, so the pages stay
// small and the screens can be previewed with sample data.

import Link from "next/link";
import styles from "./Passport.module.css";
import { RangeBar, Sparkline, TrendChart, shortDate } from "./PassportCharts";
import { STATUS_STYLE, TREND_WORDS, formatValue, timepointLabel, type RangeStatus } from "@/lib/passport";
import type { DomainSummary, MarkerSeries } from "@/lib/passportServer";

const TREND_COLOUR = { improving: "#2e6f5c", steady: "#35618f", moving_away: "#b45309", first_reading: "#7a716a" } as const;

function markerHref(key: string) {
  return `/session/passport/${encodeURIComponent(key)}`;
}

function StatusChip({ status }: { status: RangeStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={styles.chip} style={{ color: s.colour, background: s.soft }}>
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Level 1: the passport summary
// ---------------------------------------------------------------------------
export function PassportSummary({ domains }: { domains: DomainSummary[] }) {
  const all = domains.flatMap((d) => d.series);
  const areas = domains.filter((d) => d.series.length > 0).length;
  const improving = all.filter((s) => s.trend === "improving").length;
  const conversations = all.filter((s) => s.status === "worth_a_conversation").length;
  const hasTrends = all.some((s) => s.results.length > 1);

  return (
    <div className={styles.wrap}>
      <div className={styles.eyebrow}>Human Passport</div>
      <h1 className={styles.title}>My Passport</h1>
      <p className={styles.intro}>
        Everything we have measured, in one place, with what it means for you. A single test only ever shows part of the
        picture, so your results build into trends each time you are remeasured, at 3 months and again at 6 months.
      </p>

      {all.length > 0 && (
        <div className={styles.glance}>
          <div className={styles.glanceItem}>
            <div className={styles.glanceNumber}>{all.length}</div>
            <div className={styles.glanceLabel}>
              markers across {areas} area{areas === 1 ? "" : "s"}
            </div>
          </div>
          <div className={styles.glanceItem}>
            <div className={styles.glanceNumber} style={{ color: hasTrends ? TREND_COLOUR.improving : undefined }}>
              {hasTrends ? improving : "0"}
            </div>
            <div className={styles.glanceLabel}>{hasTrends ? "improving since your first reading" : "trends appear after remeasure"}</div>
          </div>
          <div className={styles.glanceItem}>
            <div className={styles.glanceNumber} style={{ color: conversations ? STATUS_STYLE.worth_a_conversation.colour : undefined }}>
              {conversations}
            </div>
            <div className={styles.glanceLabel}>worth a conversation</div>
          </div>
        </div>
      )}

      {domains.map((d) => (
        <DomainCard key={d.key} domain={d} />
      ))}
    </div>
  );
}

function domainHeadline(d: DomainSummary): string {
  const n = d.series.length;
  const anyTrend = d.series.some((s) => s.results.length > 1);
  const markers = `${n} marker${n === 1 ? "" : "s"}`;
  if (!anyTrend) return `${markers}, first readings in. Your trend appears after your next measurement.`;
  if (d.improving === 0) return `${markers}, holding steady overall since your first reading.`;
  return `${markers}, ${d.improving} improving since your first reading.`;
}

function DomainCard({ domain: d }: { domain: DomainSummary }) {
  const hasData = d.series.length > 0;
  const body = (
    <>
      <span className={styles.cardAccent} style={{ background: d.colour }} />
      <div className={styles.cardHead}>
        <div className={styles.cardName}>
          <span className={styles.dot} style={{ background: d.colour }} />
          {d.name}
        </div>
        {hasData && <span className={styles.chevron}>›</span>}
      </div>
      {hasData ? (
        <>
          <p className={styles.headline}>{domainHeadline(d)}</p>
          <div className={styles.chips}>
            {(["optimal", "in_range", "worth_a_conversation"] as const)
              .filter((k) => d.counts[k] > 0)
              .map((k) => (
                <span key={k} className={styles.chip} style={{ color: STATUS_STYLE[k].colour, background: STATUS_STYLE[k].soft }}>
                  {d.counts[k]} {STATUS_STYLE[k].label.toLowerCase()}
                </span>
              ))}
          </div>
          <div className={styles.miniRows}>
            {d.series.slice(0, 3).map((s) => (
              <div key={s.marker.marker_key} className={styles.miniRow}>
                <span className={styles.miniName}>{s.marker.name}</span>
                <span className={styles.miniValue}>
                  {formatValue(Number(s.latest.value))}
                  {s.marker.unit && <span className={styles.unit}>{s.marker.unit}</span>}
                </span>
                <Sparkline values={s.results.map((r) => Number(r.value))} colour={d.colour} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className={styles.headline}>{d.blurb}</p>
          <div className={styles.empty}>Not measured yet</div>
        </>
      )}
    </>
  );
  return hasData ? (
    <Link href={`/session/passport?domain=${d.key}`} className={styles.card}>
      {body}
    </Link>
  ) : (
    <div className={styles.card} style={{ opacity: 0.85 }}>
      {body}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Level 2: one domain
// ---------------------------------------------------------------------------
export function DomainView({ domain: d }: { domain: DomainSummary }) {
  const panels = new Map<string, MarkerSeries[]>();
  for (const s of d.series) {
    const key = s.marker.panel ?? "";
    panels.set(key, [...(panels.get(key) ?? []), s]);
  }
  return (
    <div className={styles.wrap}>
      <Link href="/session/passport" className={styles.back}>
        ‹ My Passport
      </Link>
      <div className={styles.eyebrow} style={{ color: d.colour, marginTop: 8 }}>
        {d.series.length} marker{d.series.length === 1 ? "" : "s"}
        {d.lastUpdated && `, updated ${shortDate(d.lastUpdated)}`}
      </div>
      <h1 className={styles.title}>{d.name}</h1>
      <p className={styles.intro}>{d.blurb}</p>

      {Array.from(panels.entries()).map(([panel, list]) => (
        <div key={panel || "none"}>
          {panel && <div className={styles.panelHeading}>{panel}</div>}
          {list.map((s) => (
            <Link key={s.marker.marker_key} href={markerHref(s.marker.marker_key)} className={styles.markerRow}>
              <div className={styles.markerTop}>
                <span className={styles.markerName}>{s.marker.name}</span>
                <span className={styles.markerValue}>
                  {formatValue(Number(s.latest.value))}
                  {s.marker.unit && <span className={styles.unit}>{s.marker.unit}</span>}
                </span>
              </div>
              <RangeBar marker={s.marker} results={s.results} colour={d.colour} />
              <div className={styles.trendLine}>
                <span style={{ color: TREND_COLOUR[s.trend] }}>{TREND_WORDS[s.trend]}</span>
                <StatusChip status={s.status} />
              </div>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Level 3: one marker
// ---------------------------------------------------------------------------
export function MarkerView({ series: s, domain }: { series: MarkerSeries; domain: DomainSummary }) {
  const m = s.marker;
  const hasRange = m.range_low != null || m.range_high != null;
  const hasOptimal = m.optimal_low != null || m.optimal_high != null;
  const notes = [...s.results].reverse().filter((r) => r.clinician_note);

  return (
    <div className={styles.wrap}>
      <Link href={`/session/passport?domain=${domain.key}`} className={styles.back}>
        ‹ {domain.name}
      </Link>
      <div className={styles.eyebrow} style={{ color: domain.colour, marginTop: 8 }}>
        {m.panel ?? domain.name}
      </div>
      <h1 className={styles.title}>{m.name}</h1>
      <div className={styles.bigValue}>
        {formatValue(Number(s.latest.value))}
        {m.unit && <span className={styles.bigUnit}>{m.unit}</span>}
      </div>
      <div className={styles.trendLine} style={{ marginTop: 10, justifyContent: "flex-start", gap: 10 }}>
        <StatusChip status={s.status} />
        <span style={{ color: TREND_COLOUR[s.trend] }}>{TREND_WORDS[s.trend]}</span>
      </div>

      <div className={styles.chartCard}>
        <TrendChart marker={m} results={s.results} colour={domain.colour} />
        {(hasRange || hasOptimal) && (
          <div className={styles.legend}>
            {hasRange && (
              <span>
                <span className={styles.swatch} style={{ background: "#e6edf5" }} />
                Healthy range
              </span>
            )}
            {hasOptimal && (
              <span>
                <span className={styles.swatch} style={{ background: "#d7ebe3" }} />
                Optimal range
              </span>
            )}
          </div>
        )}
      </div>

      {notes.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>From your care team</div>
          <p className={styles.sectionBody}>{notes[0].clinician_note}</p>
          <div className={styles.noteBy}>
            On your {timepointLabel(notes[0].timepoint).toLowerCase()} result, {shortDate(notes[0].taken_on)}
          </div>
        </div>
      )}

      {m.explanation && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>What this measures</div>
          <p className={styles.sectionBody}>{m.explanation}</p>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Every reading</div>
        <table className={styles.history}>
          <tbody>
            {[...s.results].reverse().map((r) => (
              <tr key={r.id}>
                <td>{timepointLabel(r.timepoint)}</td>
                <td style={{ color: "var(--muted)" }}>{shortDate(r.taken_on)}</td>
                <td className={styles.historyValue}>
                  {formatValue(Number(r.value))}
                  {m.unit && <span className={styles.unit}>{m.unit}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
