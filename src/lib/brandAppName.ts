// The name shown under the app's icon on a phone's home screen. Phones cut
// off anything much past twelve characters, so a long pack name such as
// "Regenerate Wellness" becomes its first word. Safe for browser and server.
export function homeScreenName(packName: string): string {
  const name = packName.trim();
  if (name.length <= 12) return name;
  const first = name.split(/\s+/)[0];
  return first.length > 0 && first.length <= 12 ? first : name.slice(0, 12).trim();
}
