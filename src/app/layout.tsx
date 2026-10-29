import type { Metadata, Viewport } from "next";
import { Archivo_Black, Fraunces, Inter, Lexend } from "next/font/google";
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
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${lexend.variable} ${archivoBlack.variable}`}>
      <body>{children}</body>
    </html>
  );
}
