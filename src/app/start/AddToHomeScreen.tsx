"use client";

import { useEffect, useState } from "react";
import styles from "./AddToHomeScreen.module.css";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

export default function AddToHomeScreen() {
  const [platform, setPlatform] = useState<"ios" | "android" | "none">("none");
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) {
      setPlatform("ios");
    } else if (/Android/.test(ua)) {
      setPlatform("android");
    }

    function handler(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed || dismissed || platform === "none") return null;

  async function handleInstallClick() {
    if (installEvent) {
      await installEvent.prompt();
      setDismissed(true);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.title}>Add this to your home screen</div>
      {platform === "ios" ? (
        <p className={styles.text}>
          Tap the <b>Share</b> icon below, then <b>&ldquo;Add to Home Screen&rdquo;</b> — so
          your programme is always one tap away.
        </p>
      ) : installEvent ? (
        <>
          <p className={styles.text}>So your programme is always one tap away.</p>
          <button type="button" className={styles.button} onClick={handleInstallClick}>
            Add to home screen
          </button>
        </>
      ) : (
        <p className={styles.text}>
          Open your browser menu and choose <b>&ldquo;Add to Home Screen&rdquo;</b> — so your
          programme is always one tap away.
        </p>
      )}
      <button type="button" className={styles.dismiss} onClick={() => setDismissed(true)}>
        Not now
      </button>
    </div>
  );
}
