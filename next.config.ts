import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Email templates and Meet David & Friends moved out of the old Content
  // section and into Vault, which is now the single home for reusable
  // content. Permanent redirects rather than deleted routes, so David's
  // existing bookmarks and any link already sent out still land in the
  // right place. /clinic/content itself is handled by its own page, which
  // has redirected since the Content hub's tile grid was removed.
  async redirects() {
    return [
      {
        source: "/clinic/content/email-templates",
        destination: "/clinic/vault/email-templates",
        permanent: true,
      },
      {
        source: "/clinic/content/friends",
        destination: "/clinic/vault/friends",
        permanent: true,
      },
      {
        source: "/clinic/content/friends/:path*",
        destination: "/clinic/vault/friends/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
