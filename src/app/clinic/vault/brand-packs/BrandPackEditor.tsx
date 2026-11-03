"use client";

import { BRAND_HEADING_FONTS } from "@/lib/brandFonts";
import { normaliseAppLayout, type AppLayout } from "@/lib/appLayout";
import AppLayoutEditor from "./AppLayoutEditor";
import AppImagesEditor from "./AppImagesEditor";
import PaletteEditor from "./PaletteEditor";
import ClientLinkField from "./ClientLinkField";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";
import confirmStyles from "../equipment/EquipmentManager.module.css";
import styles from "./BrandPacks.module.css";
import { useUnsavedChanges } from "../../useUnsavedChanges";
import { BRAND_PACK_COMPONENTS, type BrandPackComponentKey } from "@/lib/brandPackSpec";
import BrandPackComponentUploader from "./BrandPackComponentUploader";
import type { BrandPack, BrandPackUsage } from "@/lib/brandPack";

type Props = {
  mode: "create" | "edit";
  packId: string;
  isDefault: boolean;
  initial: Pick<
    BrandPack,
    | "name"
    | "accent_color"
    | "background_color"
    | "theme"
    | "logo_mark_url"
    | "wordmark_url"
    | "cover_square_url"
    | "wide_banner_url"
    | "small_square_url"
    | "background_texture_url"
    | "wordmark_reversed_url"
  > & { heading_font?: string | null; app_layout?: unknown };
  usage: BrandPackUsage | null;
};

type ImageUrls = Record<BrandPackComponentKey, string | null>;

function urlsFromPack(initial: Props["initial"]): ImageUrls {
  return {
    logo_mark: initial.logo_mark_url,
    wordmark: initial.wordmark_url,
    cover_square: initial.cover_square_url,
    wide_banner: initial.wide_banner_url,
    small_square: initial.small_square_url,
    background_texture: initial.background_texture_url,
    wordmark_reversed: initial.wordmark_reversed_url,
  };
}

export default function BrandPackEditor({ mode, packId, isDefault, initial, usage }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [accentColor, setAccentColor] = useState(initial.accent_color);
  const [backgroundColor, setBackgroundColor] = useState(initial.background_color);
  const [theme, setTheme] = useState<"light" | "dark">(initial.theme === "dark" ? "dark" : "light");
  const [headingFont, setHeadingFont] = useState<string | null>(initial.heading_font ?? null);
  const [appLayout, setAppLayout] = useState<AppLayout>(() => normaliseAppLayout(initial.app_layout));
  const [imageUrls, setImageUrls] = useState<ImageUrls>(urlsFromPack(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { markSaved } = useUnsavedChanges({ name, accentColor, backgroundColor, theme, headingFont, appLayout, imageUrls });

  // Ref, not plain state -- survives across renders so an upload firing
  // before the first Save click, then Save clicked later, never double-
  // creates the row. Same pattern as the Friends admin form.
  const createdRef = useRef(mode === "edit");
  async function ensureCreated() {
    if (createdRef.current) return;
    const res = await fetch("/api/clinic/brand-packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: packId,
        name: name.trim() || "Untitled pack",
        accent_color: accentColor,
        background_color: backgroundColor,
        theme,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn't start this pack.");
    createdRef.current = true;
  }

  async function handleUpload(component: BrandPackComponentKey, file: File): Promise<{ url: string; warning: string | null }> {
    await ensureCreated();
    const formData = new FormData();
    formData.append("component", component);
    formData.append("image", file);
    const res = await fetch(`/api/clinic/brand-packs/${packId}/image`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed.");
    setImageUrls((prev) => ({ ...prev, [component]: data.url }));
    return { url: data.url, warning: data.warning ?? null };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await ensureCreated();
      const res = await fetch(`/api/clinic/brand-packs/${packId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          accent_color: accentColor,
          background_color: backgroundColor,
          theme,
          heading_font: headingFont,
          app_layout: appLayout,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setSaved(true);
      markSaved({ name, accentColor, backgroundColor, theme, headingFont, appLayout, imageUrls });
      if (mode === "create") router.push(`/clinic/vault/brand-packs/${packId}`);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/clinic/brand-packs/${packId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      router.push("/clinic/vault/brand-packs");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  }

  const paletteIncomplete =
    appLayout.palette !== null &&
    (Object.entries(appLayout.palette) as [string, string][]).some(([k, v]) => k !== "body" && !/^#[0-9a-fA-F]{6}$/.test(v));

  const hasUsage = usage && (usage.programmeNames.length > 0 || usage.patientNames.length > 0);

  const SECTIONS = [
    { id: "pack-name", title: "Name and style" },
    { id: "pack-colours", title: "Colours" },
    { id: "pack-images", title: "Brand images" },
    { id: "pack-app-images", title: "App images" },
    { id: "pack-app", title: "What clients see" },
  ];
  const section = (n: number, note: string) => (
    <>
      <h4 className={styles.sectionTitle}>
        <span className={styles.sectionNumber}>{n}</span>
        {SECTIONS[n - 1].title}
      </h4>
      <p className={styles.sectionNote}>{note}</p>
    </>
  );

  return (
    <div className={styles.editorLayout}>
      <div className={clinicStyles.card}>
        <nav className={styles.jumpList} aria-label="Parts of this brand pack">
          {SECTIONS.map((sec, i) => (
            <a key={sec.id} href={`#${sec.id}`} className={styles.jumpLink}>
              {i + 1}. {sec.title}
            </a>
          ))}
        </nav>

        <section id="pack-name" className={styles.section}>
          {section(1, "What the pack is called, its link for clients, whether they see a light or dark app, and the font for headings.")}
          <div className={clinicStyles.field}>
            <label className={clinicStyles.label}>Pack name</label>
            <input
              className={clinicStyles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isDefault}
              placeholder="e.g. Atomic Basketball"
            />
            {isDefault && (
              <p className={clinicStyles.notice} style={{ marginTop: 6 }}>
                This is the permanent fallback pack, so it can&apos;t be renamed or deleted, but its colours and images can
                still be updated.
              </p>
            )}
          </div>

          <ClientLinkField
            linkName={appLayout.link_name}
            packName={name}
            isDefault={isDefault}
            onChange={(link_name) => setAppLayout({ ...appLayout, link_name })}
          />

          <div className={clinicStyles.field} style={{ marginTop: 18 }}>
            <label className={clinicStyles.label}>Client page style</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(
                [
                  { value: "light", title: "Light", note: "Today's cream page." },
                  {
                    value: "dark",
                    title: "Dark",
                    note: "A toned canvas built from the accent colour, with the background texture fixed along the bottom and light boxes on top.",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  aria-pressed={theme === opt.value}
                  className={`${styles.choice} ${theme === opt.value ? styles.choiceOn : ""}`}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{opt.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>{opt.note}</div>
                </button>
              ))}
            </div>
            {theme === "dark" && !imageUrls.wordmark_reversed && (
              <p className={clinicStyles.notice} style={{ marginTop: 8 }}>
                Add the reversed wordmark in section 3 so the name reads clearly on the dark banner. Until then the banner
                shows the ordinary wordmark.
              </p>
            )}
          </div>

          <div className={clinicStyles.field} style={{ marginTop: 18 }}>
            <label className={clinicStyles.label}>Heading font</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[{ key: null, label: "Athena standard", note: "The app's usual Fraunces headings.", cssVar: "--font-fraunces" }, ...BRAND_HEADING_FONTS].map((opt) => {
                const on = headingFont === opt.key;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setHeadingFont(opt.key)}
                    aria-pressed={on}
                    className={`${styles.choice} ${on ? styles.choiceOn : ""}`}
                    style={{ flex: "1 1 180px" }}
                  >
                    <div style={{ fontFamily: `var(${opt.cssVar}), serif`, fontSize: 19, fontWeight: 600 }}>{opt.label}</div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>{opt.note}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section id="pack-colours" className={styles.section}>
          {section(
            2,
            "The two main colours, and, if you want finer control, a full palette that sets every colour in the client's app."
          )}
          <div className={styles.colorRow}>
            <div className={styles.colorField}>
              <label className={clinicStyles.label}>Accent colour</label>
              <div className={styles.colorPickRow}>
                <input type="color" className={styles.colorSwatch} value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                <input className={styles.colorHexInput} value={accentColor} onChange={(e) => setAccentColor(e.target.value)} placeholder="#B83A60" />
              </div>
            </div>
            <div className={styles.colorField}>
              <label className={clinicStyles.label}>Background colour</label>
              <div className={styles.colorPickRow}>
                <input type="color" className={styles.colorSwatch} value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
                <input className={styles.colorHexInput} value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} placeholder="#EFEAE6" />
              </div>
            </div>
          </div>
          <PaletteEditor
            palette={appLayout.palette}
            onChange={(palette) => setAppLayout({ ...appLayout, palette })}
            accent={accentColor}
            background={backgroundColor}
            theme={theme}
          />
        </section>

        <section id="pack-images" className={styles.section}>
          {section(3, "The seven main images. Each one saves the moment you add it.")}
          <div className={styles.uploadGrid}>
            {BRAND_PACK_COMPONENTS.map((spec) => (
              <BrandPackComponentUploader
                key={spec.key}
                spec={spec}
                existingUrl={imageUrls[spec.key]}
                onUpload={(file) => handleUpload(spec.key, file)}
              />
            ))}
          </div>
        </section>

        <section id="pack-app-images" className={styles.section}>
          {section(4, "Extra images for a pack with an app of its own. These are kept when you press Save at the bottom.")}
          <AppImagesEditor packId={packId} layout={appLayout} onChange={setAppLayout} />
        </section>

        <section id="pack-app" className={styles.section}>
          {section(5, "Which parts of the app clients on this pack can see, the app's name and wording, and the team.")}
          <AppLayoutEditor packId={packId} layout={appLayout} onChange={setAppLayout} />
        </section>

        {error && (
          <div className={clinicStyles.error} style={{ marginTop: 16 }}>
            {error}
          </div>
        )}

        <div className={styles.saveBar}>
          <button
            type="button"
            className={clinicStyles.button}
            style={{ width: "auto", padding: "0 28px" }}
            disabled={saving || !name.trim() || !accentColor.trim() || !backgroundColor.trim() || paletteIncomplete}
            onClick={handleSave}
          >
            {saving ? "Saving…" : saved ? "Save changes" : "Save pack"}
          </button>
          {paletteIncomplete && (
            <span style={{ fontSize: 12.5, color: "var(--amber, #b45309)" }}>Fill in every colour in the full palette to save.</span>
          )}
          {mode === "edit" && !isDefault && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              style={{ background: "none", border: "none", padding: 0, font: "inherit", fontSize: 13.5, color: "var(--muted)", cursor: "pointer", marginLeft: "auto" }}
            >
              Delete this pack
            </button>
          )}
        </div>

        {confirmingDelete && (
          <div className={confirmStyles.confirmOverlay}>
            <div className={confirmStyles.confirmBox}>
              {hasUsage ? (
                <>
                  <p>
                    &ldquo;{name}&rdquo; is currently assigned to:
                  </p>
                  <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                    {usage!.programmeNames.map((n, i) => (
                      <li key={`p-${i}`}>Programme: {n}</li>
                    ))}
                    {usage!.patientNames.map((n, i) => (
                      <li key={`c-${i}`}>Client: {n}</li>
                    ))}
                  </ul>
                  <p>Deleting it will clear those assignments, and they&apos;ll fall back to the default pack. This can&apos;t be undone.</p>
                </>
              ) : (
                <p>Delete &ldquo;{name}&rdquo;? This can&apos;t be undone.</p>
              )}
              {deleteError && <p style={{ color: "var(--crimson-text, var(--crimson))", fontSize: 12.5 }}>{deleteError}</p>}
              <div className={confirmStyles.confirmActions}>
                <button type="button" className={clinicStyles.buttonSecondary} onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </button>
                <button type="button" className={clinicStyles.button} onClick={confirmDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete it"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.previewPanel}>
        <div className={clinicStyles.label} style={{ marginBottom: 10 }}>
          Live preview
        </div>
        <div className={styles.previewCoverWrap}>
          {imageUrls.cover_square ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrls.cover_square} alt="" className={styles.previewCoverImg} />
          ) : (
            <div className={styles.previewCoverPlaceholder} style={{ background: backgroundColor }}>
              No cover yet
            </div>
          )}
        </div>

        <div className={styles.mockCard}>
          <div className={styles.mockCardTop} style={{ background: accentColor }}>
            <span className={styles.mockCardTopText}>{name || "Pack name"}</span>
          </div>
          <div className={styles.mockCardBody} style={{ background: backgroundColor }}>
            <div className={styles.mockCardBodyTitle}>Sample programme card</div>
            <div className={styles.mockCardBodyBar} style={{ background: accentColor, opacity: 0.35 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
