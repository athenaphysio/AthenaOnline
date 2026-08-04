"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import styles from "../../clinic/clinic.module.css";

export default function CoachLoginPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data }) => {
      // A session alone isn't enough -- it could belong to a patient, or
      // staff without the coach role. /coach itself only accepts an actual
      // staff row with role "coach" (requireCoach in coachAuth.ts) and
      // bounces anything else back here, so redirecting on session
      // presence alone caused an infinite redirect loop for any other
      // logged-in account. Check the same thing /coach checks before
      // deciding to skip the login form.
      if (!data.session) {
        setCheckingSession(false);
        return;
      }
      const { data: staff } = await supabase
        .from("staff")
        .select("role")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (staff?.role === "coach") {
        router.replace("/coach");
      } else {
        setCheckingSession(false);
      }
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Incorrect email or password.");
      setLoading(false);
      return;
    }
    router.replace("/coach");
  }

  if (checkingSession) {
    return (
      <div className={styles.app}>
        <div className={styles.centeredInner}>
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            One moment…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <div className={styles.centeredInner}>
        <div className={styles.brandbar}>
          <Image src="/icons/athena-mark.png" alt="" width={26} height={26} />
          <div className={styles.brandname}>Athena Physio — Coach</div>
        </div>

        <h1 className={styles.heading}>Coach login</h1>
        <p className={styles.subheading}>Log in with the account David set up for you.</p>

        {error && <div className={styles.error}>{error}</div>}

        {/* A light card, not bare fields on the canvas -- see the matching
            comment on /clinic/login. */}
        <form onSubmit={handleSubmit} className={styles.card}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className={styles.field} style={{ marginBottom: 0 }}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className={styles.button} disabled={loading} style={{ marginTop: 16 }}>
            {loading ? "One moment…" : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
