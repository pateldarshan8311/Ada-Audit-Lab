import type { Metadata } from "next";

import "./globals.css";

import { APP_NAME } from "@/lib/constants/app";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Run deep Page Speed and WCAG audits locally with Lighthouse, Puppeteer, axe-core, and AI-assisted remediation guidance."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased">
        {children}
      </body>
    </html>
  );
}
