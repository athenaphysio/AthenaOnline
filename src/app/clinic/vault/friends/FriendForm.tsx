"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";
import ImageUploader from "../../ImageUploader";
import { useUnsavedChanges } from "../../useUnsavedChanges";

type Props = {
  mode: "create" | "edit";
  friendId: string;
  initialName: string;
  initialJobTitle: string | null;
  initialPhotoUrl: string | null;
  initialBioText: string | null;
  initialWeblink: string | null;
};

export default function FriendForm({
  mode,
  friendId,
  initialName,
  initialJobTitle,
  initialPhotoUrl,
  initialBioText,
  initialWeblink,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [jobTitle, setJobTitle] = useState(initialJobTitle ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl);
  const [bioText, setBioText] = useState(initialBioText ?? "");
  const [weblink, setWeblink] = useState(initialWeblink ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { markSaved } = useUnsavedChanges({ name, jobTitle, photoUrl, bioText, weblink });

  // A ref, not a plain variable -- this needs to survive across renders
  // (an upload can happen, then Save clicked later, in a different render's
  // closure) so the create POST never fires twice for the same id.
  const createdRef = useRef(mode === "edit");
  async function ensureCreated() {
    if (createdRef.current) return;
    const res = await fetch("/api/clinic/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: friendId, name: name.trim() || "Untitled" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn't start this entry.");
    createdRef.current = true;
  }

  async function uploadPhoto(file: File): Promise<string> {
    // In create mode this friend row doesn't exist yet -- see the matching
    // comment in the photo route. The url still comes back fine for
    // preview; real persistence happens via handleSubmit's own payload
    // below, same as a programme template's cover image.
    await ensureCreated();
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`/api/clinic/friends/${friendId}/photo`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed.");
    setPhotoUrl(data.url);
    return data.url;
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      await ensureCreated();
      const res = await fetch(`/api/clinic/friends/${friendId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          job_title: jobTitle.trim() || null,
          bio_text: bioText.trim() || null,
          weblink: weblink.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setSaved(true);
      markSaved({ name, jobTitle, photoUrl, bioText, weblink });
      if (mode === "create") router.push(`/clinic/vault/friends/${friendId}`);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.row2}>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Name</label>
          <input className={clinicStyles.input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Job title</label>
          <input className={clinicStyles.input} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        </div>
      </div>

      <div className={clinicStyles.field}>
        <label className={clinicStyles.label}>Photo</label>
        <ImageUploader existingUrl={photoUrl} onUpload={uploadPhoto} />
        <p className={clinicStyles.notice} style={{ marginTop: 6 }}>
          Cropped automatically to a portrait rectangle with rounded corners and a crimson border, same
          treatment for everyone.
        </p>
      </div>

      <div className={clinicStyles.field}>
        <label className={clinicStyles.label}>Bio text</label>
        <textarea className={clinicStyles.textarea} style={{ minHeight: 100 }} value={bioText} onChange={(e) => setBioText(e.target.value)} />
      </div>

      <div className={clinicStyles.field} style={{ marginBottom: 0 }}>
        <label className={clinicStyles.label}>Weblink</label>
        <input
          className={clinicStyles.input}
          value={weblink}
          onChange={(e) => setWeblink(e.target.value)}
          placeholder="https://…"
        />
      </div>

      {error && (
        <div className={clinicStyles.error} style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      <button
        type="button"
        className={clinicStyles.button}
        style={{ marginTop: 20 }}
        disabled={saving || !name.trim()}
        onClick={handleSubmit}
      >
        {saving ? "Saving…" : saved ? "Save changes" : "Save"}
      </button>
    </div>
  );
}
