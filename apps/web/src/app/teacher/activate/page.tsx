import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ActivateForm from "./ActivateForm";

export default async function TeacherActivatePage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role === "TEACHER" || user?.role === "ADMIN") {
    redirect("/");
  }

  return <ActivateForm />;
}
