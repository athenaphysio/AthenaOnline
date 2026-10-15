"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PageBanner from "@/components/PageBanner";
import styles from "../start.module.css";

type OtpType = "invite" | "magiclink" | "recovery" | "signup" | "email";

// Where the button in the welcome email lands. The link carries a one-time
// token; this signs the client in with it, asks them to choose a password,
// and takes them to their home screen. The password goes straight to
// Supabase and is never kept or shown by the app.
function SetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"checking" | "ready" | "expired">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const supabase = createClient();
    const tokenHash = searchParams.get("token_hash");
    const type = (searchParams.get("type") as OtpType | null) ?? "invite";

    async function start() {
      if (!tokenHash) {
        // No token: fine if they are already signed in, otherwise send them to log in.
        const { data } = await supabase.auth.getSession();
        if (data.session) setState("ready");
        else setState("expired");
        return;
      }
      const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      setState(verifyError ? "expired" : "ready");
    }
    start();
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Please choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    await fetch("/api/session/password-set", { method: "POST" }).catch(() => undefined);
    router.replace("/session");
  }

  if (state === "checking") {
    return (
      <div className={styles.app}>
        <div className={styles.inner}>
          <p className={styles.checking}>One moment…</p>
        </div>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div className={styles.app}>
        <PageBanner />
        <div className={styles.inner}>
          <h1 className={styles.heading}>This link has expired</h1>
          <p className={styles.subheading}>
            The link may be old or already used. If you have already chosen a password you can log in as usual,
            otherwise reply to your welcome email and David will send you a new one.
          </p>
          <button type="button" className={styles.button} onClick={() => router.replace("/start?mode=login")}>
            Go to log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <PageBanner />
      <div className={styles.inner}>
        <h1 className={styles.heading}>Choose your password</h1>
        <p className={styles.subheading}>You will use this to log in to the Athena app.</p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirm">
              Type it again
            </label>
            <input
              id="confirm"
              type="password"
              className={styles.input}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <button type="submit" className={styles.button} disabled={saving}>
            {saving ? "One moment…" : "Save and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordInner />
    </Suspense>
  );
}
