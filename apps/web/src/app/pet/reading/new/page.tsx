import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import ReadingNewForm from "@/components/reading/NewForm";

export default async function PetReadingNewPage({
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
        <ReadingNewForm examType="PET" initialPart={initialPart} />
      </main>
    </div>
  );
}
