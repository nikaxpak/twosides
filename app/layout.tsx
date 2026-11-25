import type { Metadata, Viewport } from "next";
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/400-italic.css";
import "@fontsource/newsreader/500.css";
import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/500.css";
import "@fontsource/schibsted-grotesk/600.css";
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
  themeColor: "#fffff9",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-serif bg-paper text-ink min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
