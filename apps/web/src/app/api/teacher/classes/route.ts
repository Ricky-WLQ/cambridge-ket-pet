import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/lib/inviteCode";

const createClassSchema = z.object({
  name: z.string().min(1).max(100),
  examFocus: z.enum(["KET", "PET"]).optional(),
});

async function requireTeacherUserId(): Promise<
  { userId: string } | { error: NextResponse }
> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return { error: NextResponse.json({ error: "请先登录" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "需要教师权限" }, { status: 403 }),
    };
  }

  return { userId };
}

export async function POST(req: Request) {
  const guard = await requireTeacherUserId();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const parsed = createClassSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "班级名称不能为空" }, { status: 400 });
  }

  // Retry on invite-code collision (extremely rare with 31^8 space)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const newClass = await prisma.class.create({
        data: {
          name: parsed.data.name.trim(),
          teacherId: userId,
          inviteCode: generateInviteCode(),
          examFocus: parsed.data.examFocus ?? null,
        },
        select: {
          id: true,
          name: true,
          inviteCode: true,
          examFocus: true,
          createdAt: true,
        },
      });
      return NextResponse.json({ class: newClass }, { status: 201 });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // Invite code collision; retry with a fresh code.
        continue;
      }
      console.error("Create class failed:", err);
      return NextResponse.json({ error: "创建班级失败" }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "创建班级失败（邀请码冲突）" },
    { status: 500 },
  );
}

export async function GET() {
  const guard = await requireTeacherUserId();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  const classes = await prisma.class.findMany({
    where: { teacherId: userId },
    select: {
      id: true,
      name: true,
      inviteCode: true,
      examFocus: true,
      createdAt: true,
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ classes });
}
