import type { Metadata, Viewport } from "next";
import { Archivo_Black, Barlow_Condensed, Figtree, Fraunces, Inter, Lexend } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Heading typefaces a brand pack can choose (see src/lib/brandFonts.ts).
// Not preloaded: the browser only fetches them on a page that uses them.
const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: "400",
  preload: false,
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  preload: false,
});

// Body typeface for a brand pack whose palette asks for it (see
// src/lib/brandPalette.ts): the closest free match to the Brother 1816 in
// Regenerate's presentations. Not preloaded, so only its pages fetch it.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Athena Physio",
  description: "Your exercise programme from Athena Physio.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Athena Physio",
  },
};

export const viewport: Viewport = {
  themeColor: "#9B1C1C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${lexend.variable} ${archivoBlack.variable} ${barlowCondensed.variable} ${figtree.variable}`}>
      <body>
        {/* Catches Android's one tap install offer the moment the page loads,
            before the app's own code has started (it is otherwise often
            missed), and registers the small service worker some Android
            browsers need before they will offer it at all. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__athenaInstallEvent=e;});" +
              "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}",
          }}
        />
        {children}
      </body>
    </html>
  );
}
