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
    "Kindred is your personalized local morning newspaper. Discover events, food & drinks, activities, history, weather, and local stories happening around you — every day, in one beautiful daily edition.",
  keywords: [
    "Kindred",
    "local newspaper app",
    "local events",
    "things to do near me",
    "local discovery",
    "daily edition",
    "local news app",
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
      "Your personalized local morning newspaper. Events, food & drinks, activities, history, weather, and local stories — one beautiful daily edition.",
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
      "Your personalized local morning newspaper. One beautiful daily edition of everything happening around you.",
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
