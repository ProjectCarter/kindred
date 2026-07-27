import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  fallback: ["Georgia", "serif"],
});

const siteUrl = "https://www.discoverkindred.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kindred — Discover what's happening around you",
    template: "%s · Kindred",
  },
  description:
    "Kindred is a premium local discovery app. Discover events, food & drinks, activities, weather, local history, today's masterpiece, today in history, and exclusive local deals happening around you — every day, in one beautiful daily experience.",
  keywords: [
    "Kindred",
    "local discovery app",
    "local events",
    "things to do near me",
    "local discovery",
    "daily guide",
    "local deals",
  ],
  authors: [{ name: "Kindred" }],
  creator: "Kindred",
  applicationName: "Kindred",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Kindred — Discover what's happening around you",
    description:
      "A premium local discovery app. Events, food & drinks, activities, weather, local history, today's masterpiece, and exclusive local deals — one beautiful daily experience.",
    siteName: "Kindred",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Kindred — Discover what's happening around you",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kindred — Discover what's happening around you",
    description:
      "A premium local discovery app. Discover everything happening around you — in one beautiful daily experience. Discover more, spend less.",
    images: ["/og-image.svg"],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicon.svg" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  category: "lifestyle",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFCF9" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0F14" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Runs before paint to prevent a flash of the wrong theme.
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('kindred-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored ? stored === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Impact.com ownership verification — uses the non-standard `value` attribute */}
        <meta
          {...({
            name: "impact-site-verification",
            value: "bfef37af-963f-458d-a6e7-51fd36995549",
          } as Record<string, string>)}
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-cream"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
