"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ClientDashboard.module.css";

export type BrandOption = {
  id: string;
  name: string;
  is_default: boolean;
  accent_color: string;
  background_color: string;
  logo_mark_url: string | null;
};

type Props = { patientId: string; currentId: string | null; packs: BrandOption[] };

// Choose which brand pack this client sees in the app and in their emails.
// "Default" clears the client's own choice, so a package or programme brand
// (or the standard Athena look) applies instead.
export default function BrandingButton({ patientId, currentId, packs }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string | null>(currentId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = packs.filter((p) => !p.is_default);
  const defaultPack = packs.find((p) => p.is_default) ?? null;
  const current = options.find((p) => p.id === currentId) ?? null;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic/brand-packs/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "patient", target_id: patientId, brand_pack_id: choice }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "That did not save. Please try again.");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnGhost}`}
        onClick={() => {
          setChoice(currentId);
          setError(null);
          setOpen(true);
        }}
        style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
      >
        <Swatch pack={current ?? defaultPack} size={12} />
        {current ? `Branding: ${current.name}` : "Branding"}
      </button>

      {open && (
        <div className={styles.modalOverlay} onClick={() => !saving && setOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose branding">
            <div className={styles.modalTitle}>Branding for this client</div>
            <p style={{ fontSize: 13, opacity: 0.75, margin: "-8px 0 16px", lineHeight: 1.5 }}>
              This sets the look of their app and the emails they receive. Choosing Default lets their package or programme
              branding apply, or the standard Athena Physio look if there is none.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }} role="radiogroup">
              <Option
                selected={choice === null}
                onSelect={() => setChoice(null)}
                pack={defaultPack}
                title="Default"
                subtitle="Package, programme or Athena Physio branding"
              />
              {options.map((p) => (
                <Option key={p.id} selected={choice === p.id} onSelect={() => setChoice(p.id)} pack={p} title={p.name} />
              ))}
              {options.length === 0 && (
                <p style={{ fontSize: 13, opacity: 0.75 }}>No brand packs yet. Create one in the Vault under Brand packs.</p>
              )}
            </div>

            {error && <div className={styles.modalError}>{error}</div>}

            <div className={styles.modalActions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving || choice === currentId} onClick={save}>
                {saving ? "Saving" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Option({
  selected,
  onSelect,
  pack,
  title,
  subtitle,
}: {
  selected: boolean;
  onSelect: () => void;
  pack: BrandOption | null;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        textAlign: "left",
        padding: "10px 12px",
        borderRadius: 10,
        cursor: "pointer",
        color: "inherit",
        font: "inherit",
        background: selected ? "rgba(242, 237, 228, 0.1)" : "transparent",
        border: `1px solid ${selected ? "var(--cream)" : "var(--border-strong)"}`,
      }}
    >
      <Swatch pack={pack} size={28} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{title}</span>
        {subtitle && <span style={{ display: "block", fontSize: 12, opacity: 0.7 }}>{subtitle}</span>}
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "2px solid var(--cream)",
          background: selected ? "var(--cream)" : "transparent",
          boxShadow: selected ? "inset 0 0 0 3px var(--charcoal-2)" : "none",
          flex: "none",
        }}
      />
    </button>
  );
}

// A small square showing the pack's background with its accent and logo.
function Swatch({ pack, size }: { pack: BrandOption | null; size: number }) {
  if (!pack) return <span style={{ width: size, height: size, borderRadius: 4, background: "var(--border)", flex: "none" }} />;
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: size > 16 ? 7 : 3,
        background: pack.background_color,
        border: `${size > 16 ? 3 : 2}px solid ${pack.accent_color}`,
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {size > 16 && pack.logo_mark_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pack.logo_mark_url} alt="" style={{ width: size - 10, height: size - 10, objectFit: "contain" }} />
      )}
    </span>
  );
}
