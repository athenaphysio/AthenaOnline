"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PageBanner from "@/components/PageBanner";
import styles from "./start.module.css";
import AddToHomeScreen from "./AddToHomeScreen";

type Mode = "signup" | "login";

function StartPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkingSession, setCheckingSession] = useState(true);
  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "login" ? "login" : "signup");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/session");
      } else {
        setCheckingSession(false);
      }
    });
  }, [router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { first_name: firstName } },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      if (data.session) {
        router.replace("/session");
        return;
      }
      setAwaitingConfirmation(true);
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Incorrect email or password.");
      setLoading(false);
      return;
    }
    router.replace("/session");
  }

  if (checkingSession) {
    return (
      <div className={styles.app}>
        <div className={styles.inner}>
          <p className={styles.checking}>One moment…</p>
        </div>
      </div>
    );
  }

  if (awaitingConfirmation) {
    return (
      <div className={styles.app}>
        <PageBanner />
        <div className={styles.inner}>
          <h1 className={styles.heading}>Almost there</h1>
          <p className={styles.subheading}>
            Check your email to confirm your account, then come back to this link and log in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <PageBanner />
      <div className={styles.inner}>
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={`${styles.tab} ${mode === "signup" ? styles.tabActive : ""}`}
            onClick={() => switchMode("signup")}
          >
            Create account
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={`${styles.tab} ${mode === "login" ? styles.tabActive : ""}`}
            onClick={() => switchMode("login")}
          >
            Log in
          </button>
        </div>

        <h1 className={styles.heading}>{mode === "signup" ? "Let's get you set up" : "Welcome back"}</h1>
        <p className={styles.subheading}>
          {mode === "signup"
            ? "Create your account. Your programme will appear here as soon as David has built it for you."
            : "Log in to see your programme."}
        </p>

        <AddToHomeScreen />

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="firstName">
                First name
              </label>
              <input
                id="firstName"
                className={styles.input}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
            </div>
          )}
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
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </div>
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "One moment…" : mode === "signup" ? "Get started" : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function StartPage() {
  return (
    <Suspense fallback={null}>
      <StartPageInner />
    </Suspense>
  );
}
