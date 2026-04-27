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
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link
          href={`/teacher/classes/${cls.id}`}
          className="inline-flex items-center gap-1 rounded-full border-2 border-ink/15 bg-white px-3 py-1.5 text-sm font-bold text-ink hover:bg-ink/5 transition"
        >
          <span aria-hidden>←</span> 返回 {cls.name}
        </Link>
        <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
          <span className="marker-yellow-thick">布置新作业</span>
        </h1>
        <p className="mt-1 text-base sm:text-lg text-ink/75 leading-relaxed">
          作业由学生在对应门户完成，系统根据答卷自动标记完成状态
        </p>
        <div className="mt-6">
          <NewAssignmentForm
            classId={cls.id}
            defaultExamType={cls.examFocus ?? "KET"}
          />
        </div>
      </main>
    </div>
  );
}
