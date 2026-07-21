import Image from "next/image";
import { login } from "./actions";
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

        <form action={login}>
          <input type="hidden" name="next" value={next} />
          <div className={styles.field}>
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
          <button className={styles.button} type="submit">
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
