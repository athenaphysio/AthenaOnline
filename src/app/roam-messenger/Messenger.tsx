"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import styles from "./messenger.module.css";

// Roam Messenger on the phone. One screen at a time: Face ID, then the
// inbox (Clients and Team), then a conversation. Everything it shows comes
// from /api/roam-messenger, which refuses anything until Face ID has been
// passed, and locks again after a few minutes without use.

type Gate = "loading" | "needs_face_id" | "locked" | "ready";

type ClientRow = {
  patientId: string;
  name: string;
  canReply: boolean;
  lastAt: string | null;
  snippet: string | null;
  unread: number;
  teamUnread: number;
  awaitingReply: boolean;
};
type Inbox = {
  me: { name: string; kind: "owner" | "coach" };
  clients: ClientRow[];
  quietClients: { patientId: string; name: string }[];
  team: { lastAt: string | null; snippet: string | null; unread: number } | null;
};
type ClientMessage = { id: string; sender: "patient" | "clinician"; body: string; created_at: string; sent_by_name: string | null };
type TeamMessage = { id: string; author_name: string; body: string; created_at: string; mine: boolean };
type Thread = { client: { patientId: string; name: string; canReply: boolean }; messages: ClientMessage[]; teamNotes: TeamMessage[] };

const BACKGROUND_LOCK_SECONDS = 30;
const POLL_MS = 15000;

function shortName(name: string): string {
  return name.replace(/^(dr|prof|professor|mr|mrs|ms|miss)\.?\s+/i, "").split(" ")[0] || name;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0 && d.toDateString() === new Date().toDateString()) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (days <= 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function isIos(): boolean {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function Messenger({
  initialClient,
  initialTab,
  initialView,
}: {
  initialClient: string | null;
  initialTab: "clients" | "team";
  initialView: "client" | "team";
}) {
  const [gate, setGate] = useState<Gate>("loading");
  const [name, setName] = useState("");
  const [faceError, setFaceError] = useState<string | null>(null);
  const [faceBusy, setFaceBusy] = useState(false);

  const [tab, setTab] = useState<"clients" | "team">(initialTab);
  const [openClient, setOpenClient] = useState<string | null>(initialClient);
  const [view, setView] = useState<"client" | "team">(initialView);
  const [teamOpen, setTeamOpen] = useState(initialTab === "team" && !initialClient);

  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [teamChannel, setTeamChannel] = useState<TeamMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [push, setPush] = useState<"unknown" | "on" | "off" | "unsupported" | "needs_home_screen" | "blocked">("unknown");
  const [showPicker, setShowPicker] = useState(false);

  const autoTried = useRef(false);
  const hiddenAt = useRef<number | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  // ----- the gate -----------------------------------------------------------
  const checkState = useCallback(async () => {
    const res = await fetch("/api/roam-messenger/state", { cache: "no-store" });
    const data = await res.json();
    if (data.state === "signed_out") {
      window.location.href = "/roam-messenger/sign-in";
      return;
    }
    if (data.state === "needs_device_code") {
      window.location.href = "/coach/verify?next=/roam-messenger";
      return;
    }
    setName(data.name ?? "");
    setGate(data.state === "ready" ? "ready" : data.state === "needs_face_id" ? "needs_face_id" : "locked");
  }, []);

  useEffect(() => {
    void checkState();
  }, [checkState]);

  // Locked responses from any request send the user back to Face ID.
  const api = useCallback(async (input: string, init?: RequestInit) => {
    const res = await fetch(input, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    if (res.status === 423) {
      setGate("locked");
      throw new Error("locked");
    }
    if (res.status === 401) {
      window.location.href = "/roam-messenger/sign-in";
      throw new Error("signed out");
    }
    return res;
  }, []);

  async function faceId(mode: "register" | "unlock") {
    setFaceBusy(true);
    setFaceError(null);
    try {
      const optRes = await fetch("/api/roam-messenger/passkey/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const opt = await optRes.json();
      if (!optRes.ok) throw new Error(opt.error ?? "Face ID could not start.");
      const response = mode === "register" ? await startRegistration({ optionsJSON: opt.options }) : await startAuthentication({ optionsJSON: opt.options });
      const verRes = await fetch("/api/roam-messenger/passkey/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, deviceLabel: navigator.userAgent }),
      });
      const ver = await verRes.json();
      if (!verRes.ok) throw new Error(ver.error ?? "Face ID did not work.");
      setGate("ready");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFaceError(/NotAllowed|cancel|abort/i.test(msg) ? "Face ID was cancelled. Tap the button to try again." : msg);
    } finally {
      setFaceBusy(false);
    }
  }

  // Try Face ID as soon as the lock screen shows; the button is there if
  // the phone wants a tap first.
  useEffect(() => {
    if (gate === "locked" && !autoTried.current) {
      autoTried.current = true;
      void faceId("unlock");
    }
    if (gate !== "locked") autoTried.current = gate === "ready" ? false : autoTried.current;
  }, [gate]);

  // Lock again if the app has been in the background for a while.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current && Date.now() - hiddenAt.current > BACKGROUND_LOCK_SECONDS * 1000) {
        hiddenAt.current = null;
        void fetch("/api/roam-messenger/lock", { method: "POST" }).finally(() => {
          setGate((g) => (g === "ready" ? "locked" : g));
          autoTried.current = false;
        });
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  async function lock() {
    await fetch("/api/roam-messenger/lock", { method: "POST" });
    autoTried.current = true;
    setGate("locked");
  }

  // ----- notifications -------------------------------------------------------
  const registration = useCallback(async () => {
    return navigator.serviceWorker.register("/roam-messenger-sw.js", { scope: "/roam-messenger" });
  }, []);

  useEffect(() => {
    if (gate !== "ready") return;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setPush(isIos() && !isStandalone() ? "needs_home_screen" : "unsupported");
        return;
      }
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") setPush("on");
      else setPush(Notification.permission === "denied" ? "blocked" : "off");
    })().catch(() => setPush("unsupported"));
  }, [gate, registration]);

  async function turnOnNotifications() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPush(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await registration();
      const keyRes = await api("/api/roam-messenger/push");
      const { publicKey } = await keyRes.json();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      const res = await api("/api/roam-messenger/push", { method: "POST", body: JSON.stringify({ subscription: sub.toJSON() }) });
      setPush(res.ok ? "on" : "off");
    } catch {
      setPush("off");
    }
  }

  // A tapped notification while the app is already open.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== "open" || typeof e.data.url !== "string") return;
      const u = new URL(e.data.url, window.location.origin);
      const c = u.searchParams.get("c");
      if (c) {
        setOpenClient(c);
        setTeamOpen(false);
        setView(u.searchParams.get("view") === "team" ? "team" : "client");
      } else if (u.searchParams.get("tab") === "team") {
        setOpenClient(null);
        setTab("team");
        setTeamOpen(true);
      }
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  // ----- loading data ---------------------------------------------------------
  const loadInbox = useCallback(async () => {
    const res = await api("/api/roam-messenger/inbox");
    if (res.ok) setInbox(await res.json());
  }, [api]);

  const loadThread = useCallback(
    async (id: string, v: "client" | "team") => {
      const res = await api(`/api/roam-messenger/clients/${encodeURIComponent(id)}?view=${v}`);
      if (res.ok) setThread(await res.json());
      else if (res.status === 404) {
        setOpenClient(null);
        setThread(null);
      }
    },
    [api]
  );

  const loadTeam = useCallback(async () => {
    const res = await api("/api/roam-messenger/team");
    if (res.ok) setTeamChannel((await res.json()).messages);
  }, [api]);

  const refresh = useCallback(async () => {
    if (openClient) await loadThread(openClient, view);
    else if (teamOpen) await loadTeam();
    else await loadInbox();
  }, [openClient, view, teamOpen, loadThread, loadTeam, loadInbox]);

  useEffect(() => {
    if (gate !== "ready") return;
    refresh().catch(() => undefined);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh().catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [gate, refresh]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length, thread?.teamNotes.length, teamChannel?.length, view]);

  function openThread(id: string, v: "client" | "team" = "client") {
    setThread(null);
    setDraft("");
    setSendError(null);
    setView(v);
    setOpenClient(id);
    setShowPicker(false);
  }

  function back() {
    setOpenClient(null);
    setTeamOpen(false);
    setThread(null);
    setTeamChannel(null);
    setDraft("");
    setSendError(null);
    window.history.replaceState(null, "", "/roam-messenger");
    loadInbox().catch(() => undefined);
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    try {
      if (openClient) {
        const res = await api(`/api/roam-messenger/clients/${encodeURIComponent(openClient)}`, {
          method: "POST",
          body: JSON.stringify({ body: text, to: view === "team" ? "team" : "client" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "That could not be sent.");
        setDraft("");
        await loadThread(openClient, view);
      } else if (teamOpen) {
        const res = await api("/api/roam-messenger/team", { method: "POST", body: JSON.stringify({ body: text }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "That could not be sent.");
        setDraft("");
        await loadTeam();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "locked") setSendError(msg);
    } finally {
      setSending(false);
    }
  }

  // ----- screens --------------------------------------------------------------
  if (gate === "loading") {
    return (
      <main className={styles.app}>
        <div className={styles.centre}>
          <p className={styles.lead}>One moment…</p>
        </div>
      </main>
    );
  }

  if (gate === "needs_face_id" || gate === "locked") {
    const setup = gate === "needs_face_id";
    return (
      <main className={styles.app}>
        <div className={styles.centre}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand-packs/regenerate/roam-logo.png" alt="ROAM" className={styles.logo} />
          <h1 className={styles.title}>Roam Messenger</h1>
          {setup ? (
            <p className={styles.lead}>
              Welcome{name ? `, ${shortName(name)}` : ""}. Roam Messenger is locked with Face ID, or your fingerprint on Android, so client
              conversations stay private if someone else picks up your phone. Set it up once and it will open with a glance from then on.
            </p>
          ) : (
            <p className={styles.lead}>Locked to keep client conversations private.</p>
          )}
          <button type="button" className={styles.primary} disabled={faceBusy} onClick={() => faceId(setup ? "register" : "unlock")}>
            {faceBusy ? "Checking…" : setup ? "Turn on Face ID" : "Unlock with Face ID"}
          </button>
          {faceError && <p className={styles.error}>{faceError}</p>}
          {setup && (
            <p className={styles.small}>
              If your phone has no Face ID or fingerprint set up, turn one on in the phone&apos;s settings first, then come back here.
            </p>
          )}
        </div>
      </main>
    );
  }

  const header = (title: string, sub?: string, withBack?: boolean) => (
    <header className={styles.header}>
      {withBack ? (
        <button type="button" className={styles.iconButton} onClick={back} aria-label="Back to inbox">
          ‹
        </button>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand-packs/regenerate/roam-logo.png" alt="ROAM" className={styles.headerLogo} />
      )}
      <div className={styles.headerText}>
        <div className={styles.headerTitle}>{title}</div>
        {sub && <div className={styles.headerSub}>{sub}</div>}
      </div>
      <button type="button" className={styles.lockButton} onClick={lock}>
        Lock
      </button>
    </header>
  );

  const composer = (placeholder: string, note?: string) => (
    <div className={styles.composer}>
      {note && <div className={styles.composerNote}>{note}</div>}
      {sendError && <div className={styles.error}>{sendError}</div>}
      <div className={styles.composerRow}>
        <textarea
          className={styles.input}
          value={draft}
          rows={1}
          placeholder={placeholder}
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
        />
        <button type="button" className={styles.send} disabled={!draft.trim() || sending} onClick={send}>
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );

  // A client's conversation, or the care team's notes about them.
  if (openClient) {
    const t = thread?.client.patientId === openClient ? thread : null;
    return (
      <main className={styles.app}>
        {header(t?.client.name ?? "Loading…", undefined, true)}
        <div className={styles.segment}>
          <button type="button" className={view === "client" ? styles.segOn : styles.seg} onClick={() => { setView("client"); setDraft(""); void loadThread(openClient, "client"); }}>
            Client
          </button>
          <button type="button" className={view === "team" ? styles.segOn : styles.seg} onClick={() => { setView("team"); setDraft(""); void loadThread(openClient, "team"); }}>
            Care team
          </button>
        </div>
        <div className={styles.thread}>
          {!t && <p className={styles.empty}>Loading the conversation…</p>}
          {t && view === "client" && t.messages.length === 0 && <p className={styles.empty}>No messages yet.</p>}
          {t && view === "client" &&
            t.messages.map((m) => (
              <div key={m.id} className={m.sender === "patient" ? styles.rowThem : styles.rowMe}>
                <div className={m.sender === "patient" ? styles.bubbleThem : styles.bubbleMe}>{m.body}</div>
                <div className={styles.meta}>
                  {m.sender === "clinician" ? `${m.sent_by_name ? shortName(m.sent_by_name) : "Care team"} · ` : ""}
                  {stamp(m.created_at)}
                </div>
              </div>
            ))}
          {t && view === "team" && (
            <p className={styles.privateNote}>Only the care team sees these notes. {t.client.name.split(" ")[0]} never does.</p>
          )}
          {t && view === "team" && t.teamNotes.length === 0 && <p className={styles.empty}>No care team notes about this client yet.</p>}
          {t && view === "team" &&
            t.teamNotes.map((n) => (
              <div key={n.id} className={n.mine ? styles.rowMe : styles.rowThem}>
                <div className={n.mine ? styles.bubbleTeamMe : styles.bubbleTeam}>{n.body}</div>
                <div className={styles.meta}>
                  {n.mine ? "You" : shortName(n.author_name)} · {stamp(n.created_at)}
                </div>
              </div>
            ))}
          <div ref={endRef} />
        </div>
        {t && view === "client" && t.client.canReply && composer(`Reply to ${t.client.name.split(" ")[0]}`)}
        {t && view === "client" && !t.client.canReply && (
          <div className={styles.readOnly}>You can read this conversation. Replying can be switched on for you in the care team settings.</div>
        )}
        {t && view === "team" && composer("Note for the care team", "The client will not see this.")}
      </main>
    );
  }

  // The general care team channel.
  if (teamOpen) {
    return (
      <main className={styles.app}>
        {header("Care team", "Everyone on the ROAM care team", true)}
        <div className={styles.thread}>
          <p className={styles.privateNote}>
            For general team matters. To talk about a particular client, open their conversation and use Care team, so only people who
            can see that client read it.
          </p>
          {!teamChannel && <p className={styles.empty}>Loading…</p>}
          {teamChannel?.length === 0 && <p className={styles.empty}>No team messages yet.</p>}
          {teamChannel?.map((n) => (
            <div key={n.id} className={n.mine ? styles.rowMe : styles.rowThem}>
              <div className={n.mine ? styles.bubbleTeamMe : styles.bubbleTeam}>{n.body}</div>
              <div className={styles.meta}>
                {n.mine ? "You" : shortName(n.author_name)} · {stamp(n.created_at)}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        {composer("Message the care team")}
      </main>
    );
  }

  // The inbox.
  const clientUnread = (inbox?.clients ?? []).reduce((s, r) => s + r.unread, 0);
  const teamUnread = (inbox?.team?.unread ?? 0) + (inbox?.clients ?? []).reduce((s, r) => s + r.teamUnread, 0);

  return (
    <main className={styles.app}>
      {header("Messages", inbox ? `Signed in as ${inbox.me.name}` : undefined)}

      {push === "off" && (
        <button type="button" className={styles.banner} onClick={turnOnNotifications}>
          Turn on notifications so your phone tells you about new messages. They never show what a message says.
        </button>
      )}
      {push === "needs_home_screen" && (
        <div className={styles.bannerStatic}>
          To get notifications on iPhone, add Roam Messenger to your Home Screen: tap the Share button, then Add to Home Screen, and open
          it from there.
        </div>
      )}
      {push === "blocked" && (
        <div className={styles.bannerStatic}>Notifications are turned off for Roam Messenger in your phone&apos;s settings.</div>
      )}

      {inbox?.team && (
        <div className={styles.segment}>
          <button type="button" className={tab === "clients" ? styles.segOn : styles.seg} onClick={() => setTab("clients")}>
            Clients{clientUnread > 0 ? ` (${clientUnread})` : ""}
          </button>
          <button type="button" className={tab === "team" ? styles.segOn : styles.seg} onClick={() => setTab("team")}>
            Team{teamUnread > 0 ? ` (${teamUnread})` : ""}
          </button>
        </div>
      )}

      <div className={styles.list}>
        {!inbox && <p className={styles.empty}>Loading…</p>}

        {inbox && tab === "clients" && inbox.clients.length === 0 && <p className={styles.empty}>No client messages yet.</p>}
        {inbox &&
          tab === "clients" &&
          inbox.clients.map((r) => (
            <button key={r.patientId} type="button" className={styles.row} onClick={() => openThread(r.patientId)}>
              <span className={styles.avatar}>{initials(r.name)}</span>
              <span className={styles.rowBody}>
                <span className={styles.rowTop}>
                  <span className={r.unread > 0 ? styles.rowNameBold : styles.rowName}>{r.name}</span>
                  <span className={styles.rowTime}>{when(r.lastAt)}</span>
                </span>
                <span className={styles.rowSnippet}>{r.snippet ?? "Care team notes only"}</span>
              </span>
              {r.unread > 0 && <span className={styles.badge}>{r.unread}</span>}
            </button>
          ))}

        {inbox && tab === "team" && inbox.team && (
          <>
            <button type="button" className={styles.row} onClick={() => { setTeamChannel(null); setTeamOpen(true); }}>
              <span className={styles.avatarTeam}>T</span>
              <span className={styles.rowBody}>
                <span className={styles.rowTop}>
                  <span className={inbox.team.unread > 0 ? styles.rowNameBold : styles.rowName}>Care team</span>
                  <span className={styles.rowTime}>{when(inbox.team.lastAt)}</span>
                </span>
                <span className={styles.rowSnippet}>{inbox.team.snippet ?? "General team messages"}</span>
              </span>
              {inbox.team.unread > 0 && <span className={styles.badge}>{inbox.team.unread}</span>}
            </button>
            {inbox.clients
              .filter((r) => r.teamUnread > 0)
              .map((r) => (
                <button key={r.patientId} type="button" className={styles.row} onClick={() => openThread(r.patientId, "team")}>
                  <span className={styles.avatar}>{initials(r.name)}</span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowTop}>
                      <span className={styles.rowNameBold}>{r.name}</span>
                    </span>
                    <span className={styles.rowSnippet}>New care team notes about this client</span>
                  </span>
                  <span className={styles.badge}>{r.teamUnread}</span>
                </button>
              ))}
            <button type="button" className={styles.linkButton} onClick={() => setShowPicker((s) => !s)}>
              {showPicker ? "Close" : "Start a care team note about a client"}
            </button>
            {showPicker && (
              <div className={styles.picker}>
                {[...inbox.clients.map((c) => ({ patientId: c.patientId, name: c.name })), ...inbox.quietClients]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => (
                    <button key={c.patientId} type="button" className={styles.pickerItem} onClick={() => openThread(c.patientId, "team")}>
                      {c.name}
                    </button>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
