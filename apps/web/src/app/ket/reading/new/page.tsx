import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import ReadingNewForm from "@/components/reading/NewForm";

export default async function KetReadingNewPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <ReadingNewForm examType="KET" />
      </main>
    </div>
  );
}
