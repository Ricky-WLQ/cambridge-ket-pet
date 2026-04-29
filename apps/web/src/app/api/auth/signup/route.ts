import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { t } from "@/i18n/zh-CN";
import { pickTone } from "@/i18n/voice";
import { derivePortalFromRequest } from "@/i18n/derivePortalFromRequest";

// Zod schema messages stay literal — they describe specific field
// validation failures and are passed through directly when shown
// inline to the user. The route-level errors (malformed body, email
// taken, etc.) use the per-portal pickTone path below.
const signupSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少 8 位").max(200),
  name: z.string().min(1).max(100).optional(),
});

export async function POST(req: Request) {
  const portal = derivePortalFromRequest(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: pickTone(t.api.malformedRequest, portal) },
      { status: 400 },
    );
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? pickTone(t.api.malformedRequest, portal) },
      { status: 400 },
    );
  }

  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "该邮箱已被注册" }, { status: 409 });
  }

  const passwordHash = await hash(password, 12);

  const user = await prisma.user.create({
    data: { email, passwordHash, name: name ?? null },
    select: { id: true, email: true, name: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
