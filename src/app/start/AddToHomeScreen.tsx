"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./AddToHomeScreen.module.css";
import { AddSquareIcon, MenuLinesIcon, MoreDotsIcon, ShareIcon, VerticalDotsIcon } from "./InstallIcons";

// Android's one tap install. Chrome (and Edge, and some others) hand the page
// this event when the app can be installed; the root layout catches it the
// moment the page loads and parks it on window, because it often arrives
// before this component has started, and is otherwise lost.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __athenaInstallEvent?: BeforeInstallPromptEvent | null;
  }
}

// Which set of steps to show. Each phone and browser hides the option in a
// different place, so the wording and pictures follow the device.
type Setup =
  | "ios-safari" // Safari on iPhone, iOS 18 and earlier: Share sits in the bottom bar
  | "ios-safari-26" // Safari on iPhone, iOS 26 and later: Share is behind the ••• button
  | "ipad-safari" // Safari on iPad: Share sits at the top beside the address
  | "ios-chrome" // Chrome on iPhone or iPad: Share sits beside the address
  | "ios-elsewhere" // another browser, or an app's built in viewer, on iPhone or iPad
  | "android-chrome"
  | "android-samsung"
  | "android-firefox"
  | "android-elsewhere" // an app's built in viewer on Android, such as Gmail or WhatsApp
  | "installed" // already opened from the home screen: nothing to show
  | "none"; // a computer, or the server's first draft of the page: nothing to show

function detectSetup(): Setup {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true) return "installed";

  const ua = window.navigator.userAgent;
  const iPadAsMac = /Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || iPadAsMac;
  const isIPad = /iPad/.test(ua) || iPadAsMac;
  // Apps that open links in their own viewer, where adding to the home
  // screen is not possible; the client has to open the page in their browser.
  const inApp = /FBAN|FBAV|Instagram|LinkedInApp|Snapchat|GSA\/|MicroMessenger|Line\//.test(ua);

  if (isIOS) {
    if (inApp) return "ios-elsewhere";
    if (/CriOS/.test(ua)) return "ios-chrome";
    if (/FxiOS|EdgiOS|OPiOS/.test(ua)) return "ios-elsewhere";
    if (isIPad) return "ipad-safari";
    // Safari 26 still reports its own version honestly, though it stopped
    // reporting the true iOS version, so this is the reliable test.
    const safari = ua.match(/Version\/(\d+)/);
    return safari && Number(safari[1]) >= 26 ? "ios-safari-26" : "ios-safari";
  }

  if (/Android/.test(ua)) {
    if (inApp || /; wv\)/.test(ua)) return "android-elsewhere";
    if (/SamsungBrowser/.test(ua)) return "android-samsung";
    if (/Firefox/.test(ua)) return "android-firefox";
    return "android-chrome";
  }

  return "none";
}

function noSubscription() {
  return () => {};
}

// prominent: the branded login page's version, outlined and titled in the
// brand's accent, so it stands out as the next step after logging in.
export default function AddToHomeScreen({ prominent = false }: { prominent?: boolean }) {
  // Read from the phone once the page is in the browser; the server cannot
  // know the device, so its version of the page shows nothing.
  const setup = useSyncExternalStore(noSubscription, detectSetup, () => "none" as Setup);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(() =>
    typeof window === "undefined" ? null : window.__athenaInstallEvent ?? null,
  );
  // On Android, a short pause before showing the written steps, in case the
  // one tap install is about to become available.
  const [waitingForAndroid, setWaitingForAndroid] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onInstallable(e: Event) {
      e.preventDefault();
      window.__athenaInstallEvent = e as BeforeInstallPromptEvent;
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      window.__athenaInstallEvent = null;
      setInstallEvent(null);
      setJustInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onInstallable);
    window.addEventListener("appinstalled", onInstalled);
    const timer = window.setTimeout(() => setWaitingForAndroid(false), 2500);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallable);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  if (dismissed || setup === "none" || setup === "installed") return null;

  const isAndroid = setup.startsWith("android");
  // Nothing on Android until the phone has had a moment to offer the one tap
  // install, so the client does not see written steps flash and then vanish.
  if (isAndroid && !installEvent && waitingForAndroid && !justInstalled) return null;

  async function handleInstallClick() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    // The phone only allows its install box to be shown once per visit, so
    // either way the button goes; if they said no, the written steps remain.
    window.__athenaInstallEvent = null;
    setInstallEvent(null);
    if (choice.outcome === "accepted") setJustInstalled(true);
  }

  async function handleCopyLink() {
    try {
      await window.navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const cardClass = prominent ? `${styles.card} ${styles.cardProminent}` : styles.card;

  if (justInstalled) {
    return (
      <div className={cardClass}>
        <div className={styles.title}>It is on your home screen</div>
        <p className={styles.text}>
          From now on, open your programme from the new icon on your home screen rather than from this
          browser, and it will open straight into the app.
        </p>
      </div>
    );
  }

  const copyLink = (
    <button type="button" className={styles.secondaryButton} onClick={handleCopyLink}>
      {copied ? "Link copied" : "Copy this page's link"}
    </button>
  );

  let body: React.ReactNode;

  switch (setup) {
    case "ios-safari-26":
      body = (
        <>
          <ol className={styles.steps}>
            <li>
              Tap the <MoreDotsIcon /> button at the bottom of the screen, beside the web address.
            </li>
            <li>
              Tap <ShareIcon /> <b>Share</b>.
            </li>
            <li>
              Scroll down the list and tap <AddSquareIcon /> <b>Add to Home Screen</b>.
            </li>
            <li>
              Leave <b>Open as Web App</b> switched on, then tap <b>Add</b> at the top right.
            </li>
          </ol>
          <p className={styles.note}>If you can already see the <ShareIcon /> button, tap that and start from step 3.</p>
        </>
      );
      break;

    case "ios-safari":
      body = (
        <>
          <ol className={styles.steps}>
            <li>
              Tap the <ShareIcon /> <b>Share</b> button in the bar at the bottom of the screen. If you cannot
              see the bar, scroll up a little and it will appear.
            </li>
            <li>
              Scroll down the list and tap <AddSquareIcon /> <b>Add to Home Screen</b>.
            </li>
            <li>
              Tap <b>Add</b> at the top right.
            </li>
          </ol>
        </>
      );
      break;

    case "ipad-safari":
      body = (
        <ol className={styles.steps}>
          <li>
            Tap the <ShareIcon /> <b>Share</b> button at the top of the screen, beside the web address.
          </li>
          <li>
            Scroll down the list and tap <AddSquareIcon /> <b>Add to Home Screen</b>.
          </li>
          <li>
            Tap <b>Add</b> at the top right.
          </li>
        </ol>
      );
      break;

    case "ios-chrome":
      body = (
        <ol className={styles.steps}>
          <li>
            Tap the <ShareIcon /> <b>Share</b> button at the top right, inside the web address bar.
          </li>
          <li>
            Scroll down the list and tap <AddSquareIcon /> <b>Add to Home Screen</b>.
          </li>
          <li>
            Tap <b>Add</b> at the top right.
          </li>
        </ol>
      );
      break;

    case "ios-elsewhere":
      body = (
        <>
          <p className={styles.text}>
            This page has opened inside another app, which cannot save it to your home screen, so the first step
            is to open it in Safari.
          </p>
          <ol className={styles.steps}>
            <li>
              Look for a button that says <b>Open in Safari</b>, or a small compass icon, usually at the bottom
              or top right, and tap it. If there is not one, copy the link below and paste it into Safari.
            </li>
            <li>
              Once you are in Safari, you will see the steps for adding it to your home screen.
            </li>
          </ol>
          {copyLink}
        </>
      );
      break;

    case "android-chrome":
      body = installEvent ? (
        <>
          <p className={styles.text}>
            One tap, and your programme gets its own icon on your home screen.
          </p>
          <button type="button" className={styles.button} onClick={handleInstallClick}>
            Add to home screen
          </button>
        </>
      ) : (
        <>
          <ol className={styles.steps}>
            <li>
              Tap the <VerticalDotsIcon /> menu at the top right of the screen.
            </li>
            <li>
              Tap <b>Add to home screen</b>, or <b>Install app</b> if that is what your phone shows.
            </li>
            <li>
              If you are asked to choose, tap <b>Install</b>, then confirm.
            </li>
          </ol>
          <p className={styles.note}>
            If the menu says <b>Open app</b> instead, it is already on your phone, so you can open it from your
            home screen or app list.
          </p>
        </>
      );
      break;

    case "android-samsung":
      body = installEvent ? (
        <>
          <p className={styles.text}>
            One tap, and your programme gets its own icon on your home screen.
          </p>
          <button type="button" className={styles.button} onClick={handleInstallClick}>
            Add to home screen
          </button>
        </>
      ) : (
        <ol className={styles.steps}>
          <li>
            Tap the <MenuLinesIcon /> menu at the bottom right of the screen.
          </li>
          <li>
            Tap <b>Add page to</b>, then <b>Home screen</b>.
          </li>
          <li>
            Tap <b>Add</b> to confirm.
          </li>
        </ol>
      );
      break;

    case "android-firefox":
      body = (
        <ol className={styles.steps}>
          <li>
            Tap the <VerticalDotsIcon /> menu, at the top or bottom right of the screen.
          </li>
          <li>
            Tap <b>Add to Home screen</b>, or <b>Install</b> if that is what your phone shows.
          </li>
          <li>
            Tap <b>Add</b> to confirm.
          </li>
        </ol>
      );
      break;

    case "android-elsewhere":
      body = (
        <>
          <p className={styles.text}>
            This page has opened inside another app, which cannot save it to your home screen, so the first step
            is to open it in Chrome.
          </p>
          <ol className={styles.steps}>
            <li>
              Tap the <VerticalDotsIcon /> menu at the top right and choose <b>Open in Chrome</b> (or <b>Open in
              browser</b>). If there is no such option, copy the link below and paste it into Chrome.
            </li>
            <li>
              Once you are in Chrome, you will see the steps for adding it to your home screen.
            </li>
          </ol>
          {copyLink}
        </>
      );
      break;
  }

  return (
    <div className={cardClass}>
      <div className={styles.title}>Add this to your home screen</div>
      {!installEvent && (
        <p className={styles.text}>So your programme is always one tap away, and opens like any other app.</p>
      )}
      {body}
      <button type="button" className={styles.dismiss} onClick={() => setDismissed(true)}>
        Not now
      </button>
    </div>
  );
}
