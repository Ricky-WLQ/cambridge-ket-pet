import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/i18n/zh-CN";
import { pickTone } from "@/i18n/voice";
import { derivePortalFromRequest } from "@/i18n/derivePortalFromRequest";

const schema = z.object({
  status: z.enum(["NEW", "REVIEWED", "MASTERED"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const portal = derivePortalFromRequest(req);

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json(
      { error: pickTone(t.api.unauthorized, portal) },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: pickTone(t.api.malformedRequest, portal) },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: pickTone(t.api.malformedRequest, portal) },
      { status: 400 },
    );
  }

  const note = await prisma.mistakeNote.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!note || note.userId !== userId) {
    return NextResponse.json({ error: "未找到错题" }, { status: 404 });
  }

  const updated = await prisma.mistakeNote.update({
    where: { id },
    data: { status: parsed.data.status },
    select: { id: true, status: true },
  });

  return NextResponse.json(updated);
}
