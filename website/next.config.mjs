/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static site — export to /out for Cloudflare Pages (no server runtime).
  output: "export",
  reactStrictMode: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  images: {
    // Static export cannot use the default image optimizer.
    unoptimized: true,
    // Our screenshots/OG assets are first-party SVGs we control.
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
