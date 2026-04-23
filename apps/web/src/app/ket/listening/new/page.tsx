import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NewListeningPicker } from "@/components/listening/NewListeningPicker";

export default async function NewKetListeningPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <NewListeningPicker portal="ket" parts={[1, 2, 3, 4, 5]} />;
}
