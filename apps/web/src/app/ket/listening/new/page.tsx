import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { NewListeningPicker } from "@/components/listening/NewListeningPicker";

export default async function NewKetListeningPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-3.5">
        <NewListeningPicker portal="ket" parts={[1, 2, 3, 4, 5]} />
      </main>
    </div>
  );
}
