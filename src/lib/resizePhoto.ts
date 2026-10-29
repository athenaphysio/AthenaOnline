// Shrinks a photo in the browser before it is sent: a square crop from the
// centre, 480 pixels across, saved as a JPEG. Drawing it onto a canvas also
// leaves behind everything else in the original file, including any
// location data. Browser only.

export const PHOTO_SIZE = 480;

export async function resizePhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file could not be opened as a photo. A JPEG or PNG works best."));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    // A headshot is usually framed a little high, so the crop favours the top.
    const sx = (img.naturalWidth - side) / 2;
    const sy = Math.max(0, (img.naturalHeight - side) * 0.3);
    const canvas = document.createElement("canvas");
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser could not prepare the photo.");
    ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
