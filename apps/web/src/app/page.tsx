import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { t } from "@/i18n/zh-CN";

export default async function Home() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-bold">{t.app.title}</h1>
          <p className="max-w-lg text-neutral-600">{t.app.tagline}</p>
        </div>

        {loggedIn ? (
          <div className="flex gap-4">
            <Link
              href="/ket"
              className="rounded-lg border border-neutral-300 px-8 py-4 text-center transition hover:border-neutral-900 hover:shadow-sm"
            >
              <div className="text-2xl font-semibold">{t.portal.ket.label}</div>
              <div className="text-sm text-neutral-500">{t.portal.ket.sub}</div>
            </Link>
            <Link
              href="/pet"
              className="rounded-lg border border-neutral-300 px-8 py-4 text-center transition hover:border-neutral-900 hover:shadow-sm"
            >
              <div className="text-2xl font-semibold">{t.portal.pet.label}</div>
              <div className="text-sm text-neutral-500">{t.portal.pet.sub}</div>
            </Link>
          </div>
        ) : (
          <Link
            href="/signup"
            className="rounded-md bg-neutral-900 px-6 py-3 text-white hover:bg-neutral-700"
          >
            {t.portal.getStarted}
          </Link>
        )}
      </main>
    </div>
  );
}
