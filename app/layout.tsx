import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kindred",
  description: "An honest advisor for everything you own.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
