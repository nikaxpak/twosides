import type { Metadata, Viewport } from "next";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/400-italic.css";
import "@fontsource/atkinson-hyperlegible-next/600.css";
import "@fontsource/im-fell-english/400.css";
import "@fontsource/im-fell-english/400-italic.css";
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
      <body className="font-sans bg-light text-ink min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
