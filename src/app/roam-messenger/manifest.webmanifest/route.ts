// Roam Messenger's own app manifest, so a clinician's phone saves it to the
// home screen as its own app, separate from the ROAM client app, opening
// straight into the inbox.
export function GET() {
  const manifest = {
    id: "/roam-messenger",
    name: "Roam Messenger",
    short_name: "Roam Msg",
    description: "Messages with ROAM clients and the care team.",
    start_url: "/roam-messenger",
    scope: "/roam-messenger",
    display: "standalone",
    background_color: "#0c1a2f",
    theme_color: "#0c1a2f",
    icons: [
      { src: "/roam-messenger/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/roam-messenger/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/roam-messenger/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
