"use client";

import { useState } from "react";
import styles from "../session/TodaySession.module.css";
import FormAnswerClient, { type FormQuestion, type SubmittedAnswer } from "../forms/[sendId]/FormAnswerClient";

type Props = {
  questions: FormQuestion[];
  brandId: string | null;
  afterRegistration: boolean;
  initial: { firstName: string; lastName: string; email: string };
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  fontFamily: "inherit",
  fontSize: 14,
  color: "var(--charcoal)",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "0 14px",
};

const labelStyle: React.CSSProperties = { display: "block", fontSize: 13.5, color: "var(--stone)", margin: "0 0 6px" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The client's name and email, so the answers reach the right record, then
// the intake questions themselves, then a thank you. Arriving straight from
// the registration form, the name and email are already filled in.
export default function IntakeLinkClient({ questions, brandId, afterRegistration, initial }: Props) {
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [email, setEmail] = useState(initial.email);
  const [done, setDone] = useState(false);

  const detailsReady = firstName.trim() !== "" && lastName.trim() !== "" && EMAIL.test(email.trim());
  const prefilled = afterRegistration && initial.firstName !== "" && initial.email !== "";

  async function submit(answers: SubmittedAnswer[]) {
    const res = await fetch("/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        brand: brandId,
        after_registration: afterRegistration,
        answers,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error || "Your answers could not be sent. Please try again.");
    setDone(true);
    window.scrollTo({ top: 0 });
  }

  if (done) {
    const loginHref = `/start?mode=signup&email=${encodeURIComponent(email.trim())}&first_name=${encodeURIComponent(firstName.trim())}${
      brandId ? `&brand=${encodeURIComponent(brandId)}` : ""
    }`;
    return (
      <div className={styles.head}>
        <h1>Thank you</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--charcoal)", margin: "14px 0 0" }}>
          Thank you, {firstName.trim()}. Your answers have gone straight to Dr David Silver PhD, who will use them to
          build your programme around your goals, your history and the time you have.
        </p>
        {afterRegistration ? (
          <>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--charcoal)", margin: "12px 0 0" }}>
              If you are working with Dr David Silver PhD through the app, set up your login now with the button below;
              your details are already filled in, so it takes a moment.
            </p>
            <a
              href={loginHref}
              className={styles.doneButton}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", marginTop: 18 }}
            >
              Set up my app login
            </a>
          </>
        ) : (
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--charcoal)", margin: "12px 0 0" }}>
            There is nothing more you need to do, and you can close this page.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={styles.head}>
        <h1>Programme intake</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--stone)", margin: "12px 0 6px" }}>
          {afterRegistration ? "Thank you for registering. " : ""}
          These questions help Dr David Silver PhD build a programme around your goals, your history and the time you
          have. It takes about ten minutes, and anything marked optional can be left blank.
        </p>
      </div>

      <div className={styles.list}>
        <div className={styles.card} style={{ padding: "16px 18px" }}>
          {prefilled ? (
            <div style={{ fontSize: 14, color: "var(--charcoal)", lineHeight: 1.6 }}>
              Filling this in for{" "}
              <strong>
                {firstName} {lastName}
              </strong>{" "}
              ({email}).
            </div>
          ) : (
            <>
              <div style={{ fontSize: 15, color: "var(--charcoal)", marginBottom: 12 }}>
                Your details, so your answers reach your record. Please use the email you registered with.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={labelStyle} htmlFor="intake-first">
                    First name
                  </label>
                  <input id="intake-first" style={inputStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="intake-last">
                    Last name
                  </label>
                  <input id="intake-last" style={inputStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                </div>
              </div>
              <label style={labelStyle} htmlFor="intake-email">
                Email
              </label>
              <input
                id="intake-email"
                type="email"
                style={inputStyle}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
              />
            </>
          )}
        </div>
      </div>

      <FormAnswerClient questions={questions} onSubmit={submit} blocked={!detailsReady} submitLabel="Send my answers" />
      {!detailsReady && (
        <p style={{ fontSize: 13, color: "var(--stone)", textAlign: "center", margin: "10px 22px 0" }}>
          Please add your name and email at the top before sending.
        </p>
      )}
    </>
  );
}
