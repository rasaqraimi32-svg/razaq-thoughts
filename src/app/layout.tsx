import type { Metadata } from "next";
import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";
import { siteName, siteUrl, defaultTitle, defaultDescription } from "@/lib/site-metadata";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: { default: defaultTitle, template: `%s | ${siteName}` },
  description: defaultDescription,
  openGraph: { type: "website", siteName, title: defaultTitle, description: defaultDescription },
  twitter: { card: "summary", title: defaultTitle, description: defaultDescription },
  icons: { icon: "/journal-icon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><a href="#main-content" className="skip-link">Skip to content</a><Header /><main id="main-content" tabIndex={-1}>{children}</main><Footer /></body></html>;
}
