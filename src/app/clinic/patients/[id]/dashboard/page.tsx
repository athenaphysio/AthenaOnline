import ClinicBrandbar from "../../../ClinicBrandbar";
import styles from "./ClientDashboard.module.css";

// Phase 1 of the individual client dashboard (see athena_client_dashboard_v1.html) --
// static layout only, matching the mockup section for section with placeholder
// content. No real data wired in yet: params.id is accepted (this will become a
// real per-patient page) but deliberately unused until a later phase confirms,
// against the real schema, which of these fields already exist on patients/
// programmes/etc and which need new columns -- not guessed at here.
//
// New route, not yet linked from or replacing the existing
// /clinic/patients/[id] page -- that integration call (replace the current
// Overview tab, link out from it, or something else) is for David once
// he's seen this rendered.
export default async function ClientDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  await params;

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <ClinicBrandbar />

        {/* HEADER */}
        <div className={styles.topbar}>
          <div className={styles.nameBlock}>
            <div className={styles.avatar}>SM</div>
            <div>
              <h1>Sarah Mitchell</h1>
              <div className={styles.nameSub}>
                <span className={`${styles.badge} ${styles.badgeActive}`}>● Active</span>
                <span className={`${styles.badge} ${styles.badgeTier}`}>Athena Performance</span>
                <span className={`${styles.badge} ${styles.badgeNeutral}`}>Ankle · Football · Return to sport</span>
              </div>
            </div>
          </div>
          <div className={styles.rowActions}>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`}>
              Message
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`}>
              Book session
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`}>
              Edit details
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}>
              Adjust program
            </button>
          </div>
        </div>

        {/* DETAILS STRIP */}
        <div className={styles.detailsStrip}>
          <div className={styles.detailItem}>
            <span className={styles.label}>Age / DOB</span>
            <span className={styles.val}>34 · 12 Mar 1992</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.label}>Occupation / sport</span>
            <span className={styles.val}>Marketing manager · 5-a-side football</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.label}>Location</span>
            <span className={styles.val}>The Forge Clinic, Richmond</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.label}>Clinician</span>
            <span className={styles.val}>David Silver</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.label}>Patient since</span>
            <span className={styles.val}>14 Jan 2026</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.label}>Next session</span>
            <span className={styles.val}>Fri 14 Aug, 10:30</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.label}>Membership renews</span>
            <span className={styles.val}>20 Aug 2026</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.label}>Contact</span>
            <span className={styles.val}>07700 900123</span>
          </div>
        </div>

        {/* REFERRAL / PRESENTING COMPLAINT */}
        <div className={`${styles.card} ${styles.referralCard}`}>
          <div className={styles.referralTop}>
            <div>
              <span className={styles.label}>Reason for referral</span>
              <h3>Grade II lateral ankle sprain (right), inversion injury during a 5-a-side match</h3>
            </div>
            <a href="#" className={`${styles.btn} ${styles.btnGhost}`} style={{ whiteSpace: "nowrap" }}>
              View full intake ↗
            </a>
          </div>
          <div className={styles.referralGrid}>
            <div>
              <span className={styles.label}>Onset</span>
              <div className={styles.val}>22 Jul 2026 (2.5 wks ago)</div>
            </div>
            <div>
              <span className={styles.label}>Mechanism</span>
              <div className={styles.val}>Non-contact inversion, landing from a jump</div>
            </div>
            <div>
              <span className={styles.label}>Referred via</span>
              <div className={styles.val}>Self-referral (Instagram)</div>
            </div>
            <div>
              <span className={styles.label}>Irritability</span>
              <div className={styles.val}>Moderate, improving</div>
            </div>
            <div>
              <span className={styles.label}>Red flags</span>
              <div className={styles.val} style={{ color: "#9fd9ae" }}>
                Cleared, Ottawa rules negative
              </div>
            </div>
            <div>
              <span className={styles.label}>Goal</span>
              <div className={styles.val}>Return to 5-a-side in 6 weeks</div>
            </div>
            <div>
              <span className={styles.label}>Baseline pain (NPRS)</span>
              <div className={styles.val}>6 / 10 at intake</div>
            </div>
            <div>
              <span className={styles.label}>Baseline LEFS</span>
              <div className={styles.val}>41 / 80 at intake</div>
            </div>
          </div>
        </div>

        {/* CURRENT PROGRAM: THE HUB */}
        <div className={styles.sectionTitle}>
          <h2>Current program</h2>
          <div className={styles.rowActions}>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`}>
              Swap exercise
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`}>
              View full program ↗
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}>
              Assign new program ▾
            </button>
          </div>
        </div>

        <div className={`${styles.card} ${styles.programCard}`}>
          <div className={styles.programTop}>
            <div>
              <span className={`${styles.badge} ${styles.badgeNeutral}`}>Built via Quick Build</span>
              <h3>Return to Running, Phase 2: Load Building</h3>
              <div className={`${styles.muted} ${styles.programMeta}`}>
                Week 3 of 8 · started 20 Jul 2026 · next session due tomorrow
              </div>
            </div>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`}>
              Adjust this program
            </button>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: "37%" }} />
          </div>

          <div className={styles.phaseStrip}>
            <div className={styles.phaseLegend}>
              <span>
                <span className={`${styles.dot} ${styles.dotDone}`} />
                Phase 1, Protect &amp; restore (wk 1-2)
              </span>
              <span>
                <span className={`${styles.dot} ${styles.dotCurrent}`} />
                Phase 2, Load building (wk 3-5)
              </span>
              <span>
                <span className={`${styles.dot} ${styles.dotUpcoming}`} />
                Phase 3, Return to running (wk 6-8)
              </span>
            </div>
            <div className={styles.weekRow}>
              <div className={`${styles.weekChip} ${styles.weekChipDone}`}>W1</div>
              <div className={`${styles.weekChip} ${styles.weekChipDone}`}>W2</div>
              <div className={`${styles.weekChip} ${styles.weekChipCurrent}`}>W3</div>
              <div className={styles.weekChip}>W4</div>
              <div className={styles.weekChip}>W5</div>
              <div className={styles.weekChip}>W6</div>
              <div className={styles.weekChip}>W7</div>
              <div className={styles.weekChip}>W8</div>
            </div>
          </div>

          <div className={styles.metricGrid}>
            <div className={styles.metric}>
              <span className={styles.label}>Adherence (7d)</span>
              <div className={styles.num}>92%</div>
              <span className={styles.trendUp}>↑ vs 85% at 30d</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.label}>Current streak</span>
              <div className={styles.num}>6 days</div>
              <span className={styles.trendUp}>Personal best</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.label}>This week</span>
              <div className={styles.num}>4 / 5</div>
              <span className={styles.trendFlat}>sessions completed</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.label}>Pain today (NPRS)</span>
              <div className={styles.num}>2 / 10</div>
              <span className={styles.trendUp}>↓ from 6/10 at intake</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.label}>LEFS score</span>
              <div className={styles.num}>58 / 80</div>
              <span className={styles.trendUp}>↑ from 41/80 at intake</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.label}>Last active</span>
              <div className={styles.num} style={{ fontSize: 17 }}>
                Today
              </div>
              <span className={styles.trendFlat}>07:42am</span>
            </div>
          </div>

          <div className={styles.exerciseBlock}>
            <span className={styles.label}>This week&apos;s exercises</span>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Exercise</th>
                  <th>Prescription</th>
                  <th>Last performed</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.exName}>Single-leg balance reach</td>
                  <td>3 × 10 each side</td>
                  <td>Today</td>
                  <td className={styles.ok}>↑ Progressing</td>
                </tr>
                <tr>
                  <td className={styles.exName}>Eccentric calf raises</td>
                  <td>4 × 12 @ bodyweight</td>
                  <td>Today</td>
                  <td className={styles.ok}>↑ Progressing</td>
                </tr>
                <tr>
                  <td className={styles.exName}>Lateral band walks</td>
                  <td>3 × 15</td>
                  <td>Yesterday</td>
                  <td className={styles.muted}>→ Steady</td>
                </tr>
                <tr>
                  <td className={styles.exName}>Ankle inversion / eversion (band)</td>
                  <td>3 × 15</td>
                  <td>2 days ago</td>
                  <td className={styles.flag}>⚠ Pain flagged 4/10</td>
                </tr>
                <tr>
                  <td className={styles.exName}>Jog-walk intervals (Zone 2)</td>
                  <td>15 min</td>
                  <td>2 days ago</td>
                  <td className={styles.ok}>↑ Progressing</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* BOTTOM CONTEXT ROW */}
        <div className={styles.bottomGrid}>
          <div className={styles.card}>
            <h3>Session history</h3>
            <ul className={styles.miniList}>
              <li>
                <span>Follow-up · in clinic</span>
                <span className={styles.miniListSub}>05 Aug</span>
              </li>
              <li>
                <span>Program review · video</span>
                <span className={styles.miniListSub}>29 Jul</span>
              </li>
              <li>
                <span>Initial assessment</span>
                <span className={styles.miniListSub}>20 Jul</span>
              </li>
            </ul>
            <a href="#" className={styles.viewAll}>
              View all 9 sessions ↗
            </a>
          </div>
          <div className={styles.card}>
            <h3>Forms &amp; submissions</h3>
            <ul className={styles.miniList}>
              <li>
                <span>Initial intake</span>
                <span className={`${styles.miniListSub} ${styles.ok}`}>Complete</span>
              </li>
              <li>
                <span>PAR-Q</span>
                <span className={`${styles.miniListSub} ${styles.ok}`}>Complete</span>
              </li>
              <li>
                <span>Weekly check-in</span>
                <span className={`${styles.miniListSub} ${styles.flag}`}>Due today</span>
              </li>
            </ul>
            <a href="#" className={styles.viewAll}>
              View all forms ↗
            </a>
          </div>
          <div className={styles.card}>
            <h3>Clinical notes</h3>
            <p style={{ fontSize: 13, color: "var(--sand)", margin: 0, lineHeight: 1.6 }}>
              &ldquo;ROM near-symmetrical, mild swelling resolved. Cleared to progress to jogging intervals.&rdquo;
              05 Aug
            </p>
            <a href="#" className={styles.viewAll}>
              Add note ↗
            </a>
          </div>
        </div>

        {/* MESSAGES */}
        <div className={styles.sectionTitle}>
          <h2>Messages</h2>
        </div>
        <div className={`${styles.card} ${styles.messagesPanel}`}>
          <div className={styles.messagesHead}>
            <span className={`${styles.badge} ${styles.badgeTier}`}>Unlimited messaging · Athena Performance tier</span>
            <a href="#" className={styles.viewAll} style={{ margin: 0 }}>
              View full thread ↗
            </a>
          </div>
          <div className={styles.thread}>
            <div className={`${styles.bubble} ${styles.bubbleIn}`}>
              Felt good today, ankle a bit tight after the jog intervals, is that normal?
              <span className={styles.bubbleTime}>Sarah · 08:14am</span>
            </div>
            <div className={`${styles.bubble} ${styles.bubbleOut}`}>
              Yes, totally normal at this stage. Keep icing after the harder sessions. Let me know if it&apos;s still
              tight tomorrow.
              <span className={styles.bubbleTime}>You · 08:47am</span>
            </div>
          </div>
          <div className={styles.composer}>
            <input type="text" placeholder="Reply to Sarah…" />
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
