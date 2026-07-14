// Vimeo URLs come in two shapes from the exercise library:
//   https://vimeo.com/1205796315/b35851d26b   (unlisted video, has a privacy hash)
//   https://vimeo.com/1185623592              (plain public video)
export function vimeoEmbedUrl(vimeoUrl: string | null): string | null {
  if (!vimeoUrl) return null;

  const match = vimeoUrl.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
  if (!match) return null;

  const [, id, hash] = match;
  const params = "title=0&byline=0&portrait=0&dnt=1" + (hash ? `&h=${hash}` : "");
  return `https://player.vimeo.com/video/${id}?${params}`;
}

export type VimeoInfo = {
  embedUrl: string;
  aspectRatio: number;
};

// Looks up the real width/height of a video via Vimeo's public oEmbed API, so the
// player can be sized to its exact aspect ratio with no letterboxing. Any failure
// (missing URL, deleted/private video, network issue) resolves to null rather than
// throwing, so a broken or not-yet-added video never breaks the page.
export async function getVimeoInfo(vimeoUrl: string | null): Promise<VimeoInfo | null> {
  const embedUrl = vimeoEmbedUrl(vimeoUrl);
  if (!embedUrl || !vimeoUrl) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(vimeoUrl)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.width || !data.height) return null;

    return { embedUrl, aspectRatio: data.width / data.height };
  } catch {
    return null;
  }
}
