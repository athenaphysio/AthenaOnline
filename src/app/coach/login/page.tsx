"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../../clinic/clinic.module.css";
import AthenaLogo from "@/components/AthenaLogo";

export default function CoachLoginPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);

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

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/coach/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => undefined);
    setLoading(false);
    setResetSent(true);
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
          <AthenaLogo height={36} />
          <div className={styles.brandname}>Clinician login</div>
        </div>

        <h1 className={styles.heading}>Clinician login</h1>
        <p className={styles.subheading}>Log in with the account David set up for you.</p>

        {error && !forgot && <div className={styles.error}>{error}</div>}

        {forgot ? (
          <form onSubmit={handleForgot} className={styles.card}>
            {resetSent ? (
              <p className={styles.subheading} style={{ margin: 0 }}>
                If that email belongs to a clinician account, a link to choose a new password is on its way. It works
                once and only for a short time, so do check your junk folder if it has not arrived in a few minutes.
              </p>
            ) : (
              <>
                <p className={styles.subheading} style={{ marginTop: 0 }}>
                  Enter the email address you log in with and we will send you a link to choose a new password.
                </p>
                <div className={styles.field} style={{ marginBottom: 0 }}>
                  <label className={styles.label} htmlFor="reset-email">
                    Email address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <button type="submit" className={styles.button} disabled={loading} style={{ marginTop: 16 }}>
                  {loading ? "One moment…" : "Email me a link"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setForgot(false);
                setResetSent(false);
              }}
              style={{ marginTop: 14, background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--crimson-text, var(--crimson))", font: "inherit", textDecoration: "underline" }}
            >
              Back to log in
            </button>
          </form>
        ) : (
        // A light card, not bare fields on the canvas, as on /clinic/login.
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
          <button
            type="button"
            onClick={() => {
              setForgot(true);
              setError(null);
            }}
            style={{ marginTop: 14, background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--crimson-text, var(--crimson))", font: "inherit", textDecoration: "underline" }}
          >
            Forgot your password?
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
