import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import VocabSpellRunner from "@/components/vocab/VocabSpellRunner";

export default async function PetVocabSpellPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  return (
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-3.5">
        <VocabSpellRunner examType="PET" />
      </main>
    </div>
  );
}
