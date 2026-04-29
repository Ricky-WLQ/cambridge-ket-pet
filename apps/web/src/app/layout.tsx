import type { Metadata } from "next";
import { headers } from "next/headers";
import { manrope } from "./fonts";
import { t } from "@/i18n/zh-CN";
import { PortalProvider } from "@/i18n/PortalProvider";
import { derivePortalFromPathname } from "@/i18n/derivePortalFromPathname";
import "./globals.css";

export const metadata: Metadata = {
  title: t.app.name,
  description: t.app.metaDescription,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // x-pathname is set by middleware (Task A.5) so RootLayout can derive
  // the active portal without becoming a client component.
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "/";
  const portal = derivePortalFromPathname(pathname);
  const portalClass = portal === "ket" ? "portal-ket" : "portal-pet";

  return (
    <html
      lang="zh-CN"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body
        className={`min-h-full flex flex-col ${portalClass}`}
        suppressHydrationWarning
      >
        <PortalProvider portal={portal}>{children}</PortalProvider>
      </body>
    </html>
  );
}
