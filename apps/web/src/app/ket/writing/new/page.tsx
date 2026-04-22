import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import WritingNewForm from "@/components/writing/NewForm";

export default async function KetWritingNewPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <WritingNewForm examType="KET" />
      </main>
    </div>
  );
}
