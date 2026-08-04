import Image from "next/image";
import styles from "../clinic.module.css";

export default async function ClinicLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next || "/clinic/new";

  return (
    <div className={styles.app}>
      <div className={styles.centeredInner}>
        <div className={styles.brandbar}>
          <Image src="/icons/athena-mark.png" alt="" width={26} height={26} />
          <div className={styles.brandname}>Athena Physio</div>
        </div>

        <h1 className={styles.heading}>Clinic access</h1>
        <p className={styles.subheading}>This area is for clinic use only.</p>

        {params.error && <div className={styles.error}>Incorrect password. Try again.</div>}

        {/* A light card, not bare fields on the canvas -- the label text
            (graphite) needs a light surface under it, same as everywhere
            else in the clinic. */}
        <form action="/api/clinic/login" method="POST" className={styles.card}>
          <input type="hidden" name="next" value={next} />
          <div className={styles.field} style={{ marginBottom: 0 }}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className={styles.input}
              type="password"
              name="password"
              autoFocus
              required
            />
          </div>
          <button className={styles.button} type="submit" style={{ marginTop: 16 }}>
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
