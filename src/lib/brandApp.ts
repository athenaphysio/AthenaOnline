// Where a brand pack's own home screen app lives: its manifest (read by
// Android and desktop Chrome) and its icons (read by every phone). Each pack
// gets its own, so a client who adds the app to their phone sees their
// programme's icon, name and colours rather than Athena's. The version stamp
// changes whenever the pack is saved, so a new logo is never hidden behind an
// old cached icon. Safe for browser and server.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPackId(value: string): boolean {
  return UUID.test(value);
}

function versionQuery(updatedAt: string | null | undefined): string {
  if (!updatedAt) return "";
  const t = Date.parse(updatedAt);
  return Number.isFinite(t) ? `?v=${t}` : "";
}

export function brandManifestPath(packId: string, updatedAt?: string | null): string {
  return `/brand-app/${packId}/manifest${versionQuery(updatedAt)}`;
}

/** sizes: 180 (iPhone), 192 and 512 (Android). Maskable icons keep the logo
 * further from the edges, because Android may crop them to a circle. */
export function brandIconPath(packId: string, size: 180 | 192 | 512, updatedAt?: string | null, maskable = false): string {
  const v = versionQuery(updatedAt);
  const m = maskable ? (v ? "&maskable=1" : "?maskable=1") : "";
  return `/brand-app/${packId}/icon/${size}${v}${m}`;
}
