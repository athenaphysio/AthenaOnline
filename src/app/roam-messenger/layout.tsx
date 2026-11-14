import type { Metadata, Viewport } from "next";

// Roam Messenger's own name, icon and colours, replacing Athena's, so it
// saves to a phone's home screen as an app of its own.
export const metadata: Metadata = {
  title: "Roam Messenger",
  description: "Messages with ROAM clients and the care team.",
  manifest: "/roam-messenger/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Roam Messenger" },
  icons: {
    icon: [{ url: "/roam-messenger/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/roam-messenger/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0c1a2f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RoamMessengerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
