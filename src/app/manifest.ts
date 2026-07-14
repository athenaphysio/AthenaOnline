import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Athena Physio",
    short_name: "Athena",
    description: "Your exercise programme from Athena Physio.",
    start_url: "/",
    display: "standalone",
    background_color: "#F2EDE4",
    theme_color: "#9B1C1C",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
