// this file defines the root html shell and shared fonts
import type { Metadata } from "next";
import { Cormorant_Garamond, Space_Mono } from "next/font/google";
import "@/app/globals.css";

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono"
});

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "Mini Agentic AI System",
  description: "master agent orchestration with markdown compiled knowledge"
};

// this function renders the app root layout
export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="en">
      <body className={`${mono.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
