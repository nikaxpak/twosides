import type { Metadata, Viewport } from "next";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/400-italic.css";
import "@fontsource/source-serif-4/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Two Sides — Media Literacy Tool",
  description: "See both sides of any claim with sourced evidence",
  icons: {
    icon: "/twosides_logo.png",
    apple: "/twosides_logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-serif bg-light text-ink min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
