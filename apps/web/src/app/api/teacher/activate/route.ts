import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const activateSchema = z.object({
  code: z.string().min(1).max(100),
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const parsed = activateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "激活码不能为空" }, { status: 400 });
  }

  const code = parsed.data.code.trim();

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!currentUser) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  if (currentUser.role === "TEACHER" || currentUser.role === "ADMIN") {
    return NextResponse.json({ error: "你已经是教师身份" }, { status: 409 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const activationCode = await tx.teacherActivationCode.findUnique({
        where: { code },
      });

      if (!activationCode) {
        throw new Error("CODE_NOT_FOUND");
      }

      if (activationCode.used) {
        throw new Error("CODE_ALREADY_USED");
      }

      await tx.teacherActivationCode.update({
        where: { code },
        data: {
          used: true,
          usedById: userId,
          usedAt: new Date(),
        },
      });

      const user = await tx.user.update({
        where: { id: userId },
        data: {
          role: "TEACHER",
          activatedAt: new Date(),
        },
        select: { id: true, role: true, activatedAt: true },
      });

      return user;
    });

    return NextResponse.json({ user: result });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CODE_NOT_FOUND") {
        return NextResponse.json({ error: "激活码无效" }, { status: 400 });
      }
      if (err.message === "CODE_ALREADY_USED") {
        return NextResponse.json({ error: "激活码已被使用" }, { status: 409 });
      }
    }
    console.error("Teacher activation failed:", err);
    return NextResponse.json({ error: "激活失败，请重试" }, { status: 500 });
  }
}
