import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import ReadingNewForm from "@/components/reading/NewForm";

export default async function KetReadingNewPage({
  searchParams,
}: {
  searchParams: Promise<{ part?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const sp = await searchParams;
  const parsed = sp.part ? Number.parseInt(sp.part, 10) : NaN;
  const initialPart = Number.isFinite(parsed) ? parsed : null;
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <ReadingNewForm examType="KET" initialPart={initialPart} />
      </main>
    </div>
  );
}
