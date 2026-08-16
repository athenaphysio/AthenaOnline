import styles from "./TodaySession.module.css";

// A warmth moment, not an administrative notice -- deliberately not the
// plain .messageCard treatment used for form/account notices elsewhere on
// this page. Static content, not a dismissable popup: it simply renders
// whenever isBirthdayToday() and the programme-active check both hold, so
// a patient revisiting the dashboard on their birthday sees it again
// without it ever feeling like a re-triggering interruption. First-draft
// copy, David's to edit -- his own draft signed off with an em dash before
// "David," changed to a plain signature line since house style forbids
// em/en dashes anywhere, no exceptions, even in his own wording.
export default function BirthdayBanner({ firstName }: { firstName: string }) {
  return (
    <div className={styles.birthdayBanner}>
      Happy birthday, {firstName}! Hope today&apos;s a great one. No pressure on your session, do it if it
      feels good, or take the day off, your call.
      <div className={styles.birthdaySignature}>From David</div>
    </div>
  );
}
