import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageBanner from "@/components/PageBanner";
import styles from "./About.module.css";

// Swap each of these for a real photo once supplied: drop the file into
// /public/about/ and replace the placeholder <div> below with
// `<Image src="/about/photo-1.jpg" alt="" fill className={styles.photo} style={{ position: "relative" }} />`
// (or similar) -- everything else on the page is unaffected.
function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <div className={styles.photo}>
      <span className={styles.photoLabel}>{label}</span>
    </div>
  );
}

type Friend = {
  id: string;
  name: string;
  job_title: string | null;
  photo_url: string | null;
  bio_text: string | null;
  weblink: string | null;
};

// A trust-building bio page, not a marketing page -- reached from the
// "About" link every patient screen carries in its header (SessionHeader.tsx).
// Same auth gate as the rest of the patient app; nothing here is
// patient-specific, but there's no reason for it to sit outside the login.
export default async function AboutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/start");
  }

  const { data: friends } = await supabase
    .from("friends")
    .select("id, name, job_title, photo_url, bio_text, weblink")
    .order("sort_order")
    .returns<Friend[]>();

  return (
    <div className={styles.app}>
      <PageBanner
        href="/session"
        actions={
          <Link href="/session" className={styles.backLink}>
            ← Back
          </Link>
        }
      />
      <div className={styles.inner}>

        <div className={styles.body}>
          <h1 className={styles.heading}>Meet David &amp; Friends</h1>
          <p className={styles.credential}>Chartered Physiotherapist &middot; Founder, Athena Physiotherapy</p>

          <PhotoPlaceholder label="Photo" />

          <p className={styles.paragraph}>
            I became a physiotherapist because I was fascinated by how people could move better. Two decades
            later, that fascination hasn&apos;t dimmed. It&apos;s deepened into something I couldn&apos;t have
            predicted: a conviction that movement is empowerment, and that the most impactful clinical tool I
            possess is not my education or clinical training, but my ability to make someone feel genuinely
            understood and capable.
          </p>
          <p className={styles.paragraph}>
            People don&apos;t change because they&apos;re told what&apos;s good for them. They change when
            someone they trust translates information into something that&apos;s personally meaningful.
          </p>

          <PhotoPlaceholder label="Photo" />

          <h2 className={styles.sectionHeading}>The journey</h2>
          <div className={styles.timeline}>
            <div className={styles.timelineRow}>
              <div className={styles.timelineYear}>2007</div>
              <div className={styles.timelineEvents}>
                <div className={styles.timelineEvent}>Qualified as a Chartered Physiotherapist</div>
              </div>
            </div>
            <div className={styles.timelineRow}>
              <div className={styles.timelineYear}>2009</div>
              <div className={styles.timelineEvents}>
                <div className={styles.timelineEvent}>Joined The Forge Clinic, Richmond</div>
              </div>
            </div>
            <div className={styles.timelineRow}>
              <div className={styles.timelineYear}>2023</div>
              <div className={styles.timelineEvents}>
                <div className={styles.timelineEvent}>PhD awarded, St Mary&apos;s University</div>
                <div className={styles.timelineEvent}>Founded Athena Physiotherapy, Cobham</div>
              </div>
            </div>
          </div>

          <PhotoPlaceholder label="Photo" />

          <h2 className={styles.sectionHeading}>Credentials</h2>
          <div className={styles.credentialsList}>
            <p className={styles.credentialLine}>
              BSc (Hons) Sport Science &middot; BSc Physiotherapy &middot; MSc Sports Medicine &middot; PhD
              (Concussion Research in Youth Rugby), St Mary&apos;s University, Twickenham
            </p>
            <p className={styles.credentialLine}>
              Chartered Society of Physiotherapy No. 079015 &middot; Health &amp; Care Professions Council No.
              PH82005
            </p>
          </div>

          <hr className={styles.divider} />

          <h2 className={styles.sectionHeading}>Where I practise</h2>
          <div className={styles.practiseList}>
            <p className={styles.practiseLine}>The Forge Clinic, Richmond upon Thames</p>
            <p className={styles.practiseLine}>Athena Physiotherapy, Cobham</p>
          </div>
          <Link href="/book" className={styles.bookLink}>
            Book a face-to-face appointment →
          </Link>

          {friends && friends.length > 0 && (
            <>
              <hr className={styles.divider} />

              <div className={styles.introBox}>
                Along his journey, David has met some amazing people. Below are field leaders and inspirational
                practitioners David frequently calls upon. You can too.
              </div>

              <div className={styles.friendsList}>
                {friends.map((friend) => (
                  <div key={friend.id} className={styles.friendCard}>
                    <div className={styles.friendPhotoWrap}>
                      {friend.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={friend.photo_url} alt="" className={styles.friendPhotoImg} />
                      ) : (
                        <div className={styles.friendPhotoPlaceholder} />
                      )}
                    </div>
                    <div className={styles.friendText}>
                      <div className={styles.friendName}>{friend.name}</div>
                      {friend.job_title && <div className={styles.friendTitle}>{friend.job_title}</div>}
                      {friend.bio_text && <p className={styles.friendBio}>{friend.bio_text}</p>}
                      {friend.weblink && (
                        <a href={friend.weblink} target="_blank" rel="noopener noreferrer" className={styles.friendLink}>
                          Visit their site →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
