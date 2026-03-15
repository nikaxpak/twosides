import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Two Sides — Media Literacy Tool",
  description: "See both sides of any claim with sourced evidence",
  icons: {
    icon: "/twosides_logo.png",
    apple: "/twosides_logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#f5f5f0] text-gray-900 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
