"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../clinic.module.css";

export type PackageRow = {
  id: string;
  name: string;
  brandPackId: string | null;
  clientCount: number;
  signedCount: number;
  publishedVersion: { version: number; publishedAt: string } | null;
  draftBody: string;
  hasUnpublishedDraft: boolean;
};

type Props = { packages: PackageRow[]; brandPacks: { id: string; name: string }[] };

const small = { width: "auto", padding: "0 16px", height: 34, fontSize: 13 } as const;

export default function PackagesManager({ packages, brandPacks }: Props) {
  const router = useRouter();
  const [newName, setNewName] = useState("");

  async function create() {
    const res = await fetch("/api/clinic/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      setNewName("");
      router.refresh();
    }
  }

  return (
    <>
      {packages.map((p) => (
        <PackageCard key={p.id} pkg={p} brandPacks={brandPacks} />
      ))}
      <div className={clinicStyles.card}>
        <div className={clinicStyles.cardTitle}>New package</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id="new-package-name"
            className={clinicStyles.input}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Package name"
          />
          <button type="button" className={clinicStyles.buttonSecondary} style={small} disabled={!newName.trim()} onClick={create}>
            Create
          </button>
        </div>
      </div>
    </>
  );
}

function PackageCard({ pkg, brandPacks }: { pkg: PackageRow; brandPacks: { id: string; name: string }[] }) {
  const router = useRouter();
  const [brand, setBrand] = useState(pkg.brandPackId ?? "");
  const [body, setBody] = useState(pkg.draftBody);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stillDraftMarked = body.includes("DRAFT FOR LEGAL REVIEW") || body.includes("[");

  async function saveBrand(value: string) {
    setBrand(value);
    await fetch("/api/clinic/packages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pkg.id, brand_pack_id: value || null }),
    });
    router.refresh();
  }

  async function saveConsent(publish: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clinic/packages/${pkg.id}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, publish }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "That did not work.");
        return;
      }
      setMessage(publish ? `Version ${data.version} published. Clients in ${pkg.name} will be asked to sign it.` : "Draft saved. Clients cannot see it yet.");
      setConfirming(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={clinicStyles.card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div className={clinicStyles.cardTitle} style={{ margin: 0 }}>
          {pkg.name}
        </div>
        <div style={{ fontSize: 13, color: "var(--graphite)" }}>
          {pkg.clientCount} client{pkg.clientCount === 1 ? "" : "s"}, {pkg.signedCount} with signed consent
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label className={clinicStyles.label} htmlFor={`brand-${pkg.id}`}>
          Branding for this package&apos;s clients and clinicians
        </label>
        <select
          id={`brand-${pkg.id}`}
          className={clinicStyles.input}
          style={{ maxWidth: 360, fontSize: 14, padding: "6px 10px" }}
          value={brand}
          onChange={(e) => saveBrand(e.target.value)}
        >
          <option value="">Athena Physio (default)</option>
          {brandPacks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <p className={clinicStyles.notice}>
          Add a new brand pack in the Vault first, then pick it here. A brand chosen on an individual client still takes
          priority over the package.
        </p>
      </div>

      <div style={{ marginTop: 18 }}>
        <label className={clinicStyles.label} htmlFor={`consent-${pkg.id}`}>
          Consent wording
          {pkg.publishedVersion ? ` (version ${pkg.publishedVersion.version} is live)` : " (nothing published yet, so no clinician can see these clients)"}
        </label>
        <textarea
          id={`consent-${pkg.id}`}
          className={clinicStyles.textarea}
          style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13.5, minHeight: 300 }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <p className={clinicStyles.notice}>
          The names of the clinicians, their roles and exactly what each can see are listed automatically under this
          wording on the client&apos;s consent page, taken from the Staff page switches.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button type="button" className={clinicStyles.buttonSecondary} style={small} disabled={busy} onClick={() => saveConsent(false)}>
            Save draft
          </button>
          {!confirming ? (
            <button type="button" className={clinicStyles.buttonSecondary} style={small} disabled={busy} onClick={() => setConfirming(true)}>
              Publish
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
              <span style={{ color: stillDraftMarked ? "var(--amber)" : "var(--ink)" }}>
                {stillDraftMarked
                  ? "This still contains the draft line or [square brackets]. Publish anyway?"
                  : `Publish this wording? Every client in ${pkg.name} will need to sign it before any clinician can see their information.`}
              </span>
              <button type="button" className={clinicStyles.buttonSecondary} style={small} disabled={busy} onClick={() => saveConsent(true)}>
                Yes, publish
              </button>
              <button type="button" className={clinicStyles.buttonSecondary} style={small} onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
        {message && <p className={clinicStyles.notice}>{message}</p>}
      </div>
    </div>
  );
}
