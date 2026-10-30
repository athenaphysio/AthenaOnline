"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PageBanner from "@/components/PageBanner";
import BrandPackCookie from "@/components/BrandPackCookie";
import { loginRootProps } from "../loginRootProps";
import LoginHero from "../LoginHero";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";
import styles from "../start.module.css";

type OtpType = "invite" | "magiclink" | "recovery" | "signup" | "email";

// Where the button in the welcome email lands. The link carries a one-time
// token; this signs the client in with it, asks them to choose a password,
// and takes them to their home screen. The password goes straight to
// Supabase and is never kept or shown by the app.
function SetPasswordInner({ brand }: { brand: ResolvedBrandPack | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"checking" | "ready" | "expired" | "already">("checking");
  const [requestEmail, setRequestEmail] = useState("");
  const [requested, setRequested] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const supabase = createClient();
    const invite = searchParams.get("invite");
    let tokenHash = searchParams.get("token_hash");
    let type = (searchParams.get("type") as OtpType | null) ?? "invite";

    async function start() {
      // The seven day welcome link: swap it for a fresh one time token first.
      if (invite) {
        const res = await fetch("/api/session/invite/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invite }),
        }).catch(() => null);
        const data = res ? await res.json().catch(() => ({})) : {};
        if (!res?.ok) {
          setState(data.reason === "already_set_up" ? "already" : "expired");
          return;
        }
        tokenHash = data.token_hash;
        type = data.type;
      }
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
      <div {...loginRootProps(brand, styles)}>
        <div className={brand ? `${styles.inner} ${styles.innerBranded}` : styles.inner}>
          <p className={styles.checking}>One moment…</p>
        </div>
      </div>
    );
  }

  async function requestNewLink(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/session/invite/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: requestEmail }),
    }).catch(() => undefined);
    setRequested(true);
  }

  if (state === "already") {
    return (
      <div {...loginRootProps(brand, styles)}>
        {brand ? <LoginHero brand={brand} /> : <PageBanner />}
        <div className={brand ? `${styles.inner} ${styles.innerBranded}` : styles.inner}>
          <h1 className={styles.heading}>You are already set up</h1>
          <p className={styles.subheading}>You have already chosen a password, so you can log in as usual.</p>
          <button type="button" className={styles.button} onClick={() => router.replace("/start?mode=login")}>
            Go to log in
          </button>
        </div>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div {...loginRootProps(brand, styles)}>
        {brand ? <LoginHero brand={brand} /> : <PageBanner />}
        <div className={brand ? `${styles.inner} ${styles.innerBranded}` : styles.inner}>
          <h1 className={styles.heading}>This link has expired</h1>
          {requested ? (
            <p className={styles.subheading}>
              If that email belongs to an account still waiting to be set up, a new link is on its way. It lasts for
              seven days. Do check your junk folder if it has not arrived in a few minutes.
            </p>
          ) : (
            <>
              <p className={styles.subheading}>
                Enter your email address and we will send you a fresh link, which lasts for seven days.
              </p>
              <form onSubmit={requestNewLink}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="request-email">
                    Email address
                  </label>
                  <input
                    id="request-email"
                    type="email"
                    className={styles.input}
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <button type="submit" className={styles.button}>
                  Email me a new link
                </button>
              </form>
            </>
          )}
          <p className={styles.subheading} style={{ marginTop: 18 }}>
            Already chosen a password?{" "}
            <a href="/start?mode=login" style={{ color: "var(--crimson)" }}>
              Log in as usual
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div {...loginRootProps(brand, styles)}>
      {brand ? <LoginHero brand={brand} /> : <PageBanner />}
      <div className={brand ? `${styles.inner} ${styles.innerBranded}` : styles.inner}>
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

export default function SetPasswordClient({ brand }: { brand: ResolvedBrandPack | null }) {
  return (
    <Suspense fallback={null}>
      {brand && <BrandPackCookie packId={brand.id} />}
      <SetPasswordInner brand={brand} />
    </Suspense>
  );
}
