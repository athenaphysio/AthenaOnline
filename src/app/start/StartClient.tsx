"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PageBanner from "@/components/PageBanner";
import BrandPackCookie from "@/components/BrandPackCookie";
import { loginRootProps } from "./loginRootProps";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";
import styles from "./start.module.css";
import AddToHomeScreen from "./AddToHomeScreen";
import LoginHero from "./LoginHero";
import PasswordChecklist from "./PasswordChecklist";
import { friendlyPasswordError, passwordMeetsRules, PASSWORD_WEAK_MESSAGE } from "@/lib/passwordRules";

type Mode = "signup" | "login";

// Anyone sent the app's link can create their own account, on the standard
// Athena page as well as a brand's own page. Every account made this way
// waits for David's approval before the app opens (0111), and he is emailed
// when one is waiting (api/session/approval-alert). Clients David invites
// from the clients list skip the wait and set their password from the email.
const PUBLIC_SIGNUP_ENABLED = true;

function StartPageInner({ brand }: { brand: ResolvedBrandPack | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkingSession, setCheckingSession] = useState(true);
  // A new client lands on Create account; anyone coming back taps Log in,
  // or arrives with ?mode=login from an email.
  const signupAllowed = PUBLIC_SIGNUP_ENABLED || Boolean(brand);
  const [mode, setMode] = useState<Mode>(signupAllowed && searchParams.get("mode") !== "login" ? "signup" : "login");
  const [firstName, setFirstName] = useState(searchParams.get("first_name") ?? "");
  const [lastName, setLastName] = useState("");
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
      if (!passwordMeetsRules(password)) {
        setError(PASSWORD_WEAK_MESSAGE);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName.trim(), last_name: lastName.trim(), ...(brand ? { signup_brand: brand.id } : {}) },
          emailRedirectTo: `${window.location.origin}/start?mode=login`,
        },
      });
      if (error) {
        setError(friendlyPasswordError(error) ?? error.message);
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
      <div {...loginRootProps(brand, styles)}>
        <div className={styles.inner}>
          <p className={styles.checking}>One moment…</p>
        </div>
      </div>
    );
  }

  if (awaitingConfirmation) {
    return (
      <div {...loginRootProps(brand, styles)}>
        {brand ? <LoginHero brand={brand} /> : <PageBanner />}
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
    <div {...loginRootProps(brand, styles)}>
      {brand ? <LoginHero brand={brand} /> : <PageBanner />}
      <div className={brand ? `${styles.inner} ${styles.innerBranded}` : styles.inner}>
        {signupAllowed && (
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
        )}

        {/* A pack with its own app logo already names the app at the top,
            with its strapline, so the page goes straight to the login text. */}
        {!brand?.app_layout.app_logo && (
          <>
            <h1 className={styles.heading}>
              {mode === "signup" ? "Let's get you set up" : brand ? `Welcome to ${brand.app_layout.app_name || brand.name}` : "Welcome back"}
            </h1>
            {mode === "login" && brand?.app_layout.app_strapline && <p className={styles.strapline}>{brand.app_layout.app_strapline}</p>}
          </>
        )}
        <p className={styles.subheading}>
          {mode === "signup"
            ? brand
              ? "Create your account with your email and a password of your choosing. The team will confirm it, then your programme opens here, and you will only need to do this once on this phone."
              : "Create your account with your email and a password of your choosing. Dr David Silver PhD will confirm it, then your programme opens here, and you will only need to do this once on this phone."
            : brand
              ? "Log in with your email and the password you chose to open your programme. You will only need to do this once on this phone."
              : "Log in with your email and the password you chose. New here? Tap Create account above to get started."}
        </p>

        {/* Only on a branded login page: a phone saves the icon this page
            shows, and the standard login page cannot know the client's
            brand, so a branded client is offered it once the brand is known. */}
        {brand && <AddToHomeScreen prominent />}

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
          {mode === "signup" && brand && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="lastName">
                Last name
              </label>
              <input
                id="lastName"
                className={styles.input}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
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
              aria-describedby={mode === "signup" ? "password-rules" : undefined}
              required
            />
            {mode === "signup" && <PasswordChecklist password={password} id="password-rules" />}
          </div>
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "One moment…" : mode === "signup" ? "Create my account" : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function StartClient({ brand }: { brand: ResolvedBrandPack | null }) {
  return (
    <Suspense fallback={null}>
      {brand && <BrandPackCookie packId={brand.id} />}
      <StartPageInner brand={brand} />
    </Suspense>
  );
}
