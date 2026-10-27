import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // The command reference moved into the docs. Browsers keep the #fragment
  // through a redirect, so /reference#barcodes still lands on its category.
  async redirects() {
    return [
      { source: "/reference", destination: "/docs/commands", permanent: true },
      {
        source: "/reference/examples/:file",
        destination: "/docs/commands/examples/:file",
        permanent: true,
      },
      {
        source: "/reference/:command",
        destination: "/docs/commands/:command",
        permanent: true,
      },
      {
        source: "/og/reference/:command/image.png",
        destination: "/og/docs/commands/:command/image.png",
        permanent: true,
      },
    ];
  },
  // The playground runs code from shared links in a worker. Workers follow
  // their own script's policy, so this keeps that code from reaching other
  // servers, by fetch or by import(): it may only load the site's scripts
  // and run code with new Function.
  async headers() {
    return [
      {
        // Under /_next/static/chunks locally and /_next/static/immutable/chunks
        // on Vercel
        source: "/_next/static/:dir*/:file(turbopack-worker-.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'",
          },
        ],
      },
    ];
  },
};

export default withMDX(config);
