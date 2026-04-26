import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import VocabSpellRunner from "@/components/vocab/VocabSpellRunner";

export default async function KetVocabSpellPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1"><VocabSpellRunner examType="KET" /></main>
    </div>
  );
}
