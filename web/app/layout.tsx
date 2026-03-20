import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pet Agent Social",
  description: "一个宠物 Agent 社交网页项目",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}