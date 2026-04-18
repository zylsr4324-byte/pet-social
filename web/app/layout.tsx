import type { Metadata } from "next";

import { getAppBaseUrl } from "../lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getAppBaseUrl(),
  title: {
    default: "Pet Agent Social",
    template: "%s | Pet Agent Social",
  },
  description:
    "Pet Agent Social is an AI pet web app with SecondMe sign-in, pet chat, live status, and pet-to-pet social interactions.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Pet Agent Social",
    description:
      "Pet Agent Social is an AI pet web app with SecondMe sign-in, pet chat, live status, and pet-to-pet social interactions.",
    siteName: "Pet Agent Social",
    type: "website",
    url: "/",
    images: ["/secondme/pet-agent-social-icon.svg"],
  },
  icons: {
    icon: "/secondme/pet-agent-social-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
