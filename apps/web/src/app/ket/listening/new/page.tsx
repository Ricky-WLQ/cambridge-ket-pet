import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { NewListeningPicker } from "@/components/listening/NewListeningPicker";

export default async function NewKetListeningPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-6 pt-6">
          <Link
            href="/ket"
            className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            ← 返回 KET 门户
          </Link>
        </div>
        <NewListeningPicker portal="ket" parts={[1, 2, 3, 4, 5]} />
      </main>
    </div>
  );
}
