import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import WritingNewForm from "@/components/writing/NewForm";

export default async function KetWritingNewPage({
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
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-3.5">
        <WritingNewForm examType="KET" initialPart={initialPart} />
      </main>
    </div>
  );
}
