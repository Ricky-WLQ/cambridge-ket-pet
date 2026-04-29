import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NewAssignmentForm from "./NewAssignmentForm";

export default async function NewAssignmentPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const teacher = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!teacher || (teacher.role !== "TEACHER" && teacher.role !== "ADMIN")) {
    redirect("/teacher/activate");
  }

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, teacherId: true, examFocus: true },
  });
  if (!cls || cls.teacherId !== userId) notFound();

  return (
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-3.5">
        <div className="mx-auto max-w-2xl w-full">
          <div className="px-1">
            <Link
              href={`/teacher/classes/${cls.id}`}
              className="text-sm font-bold text-ink/70 hover:text-ink hover:underline"
            >
              ← 返回 {cls.name}
            </Link>
          </div>
          <div className="mt-2 px-1">
            <h1 className="text-lg font-extrabold leading-tight">布置新作业</h1>
            <p className="mt-0.5 text-xs font-medium text-ink/60">
              作业由学生在对应门户完成，系统根据答卷自动标记完成状态
            </p>
          </div>
          <div className="mt-4">
            <NewAssignmentForm
              classId={cls.id}
              defaultExamType={cls.examFocus ?? "KET"}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
