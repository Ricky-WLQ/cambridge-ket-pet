import type { Metadata } from "next";
import { manrope } from "./fonts";
import { t } from "@/i18n/zh-CN";
import "./globals.css";

export const metadata: Metadata = {
  title: t.app.name,
  description: t.app.metaDescription,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
