// Vimeo URLs come in two shapes from the exercise library:
//   https://vimeo.com/1205796315/b35851d26b   (unlisted video, has a privacy hash)
//   https://vimeo.com/1185623592              (plain public video)
export function vimeoEmbedUrl(vimeoUrl: string | null): string | null {
  if (!vimeoUrl) return null;

  const match = vimeoUrl.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
  if (!match) return null;

  const [, id, hash] = match;
  return hash ? `https://player.vimeo.com/video/${id}?h=${hash}` : `https://player.vimeo.com/video/${id}`;
}
