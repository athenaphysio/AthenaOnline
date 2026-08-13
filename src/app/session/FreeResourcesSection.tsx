import sessionStyles from "./TodaySession.module.css";

// New section, sits directly before the (now standalone) Recommended
// equipment link. Content and a real photo are still to come from David --
// this is a plain, clearly-marked placeholder, not a stand-in photo
// generated or sourced for this.
export default function FreeResourcesSection() {
  return (
    <div>
      <div className={sessionStyles.sectionHeading}>Free Resources</div>
      <div className={sessionStyles.placeholderPhoto}>
        <span className={sessionStyles.placeholderPhotoLabel}>Image placeholder, David to supply</span>
      </div>
    </div>
  );
}
