import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const confirm = String(body?.confirmPassword ?? "");

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk)
      return NextResponse.json({ error: "请输入合法邮箱地址" }, { status: 400 });
    if (password.length < 8)
      return NextResponse.json({ error: "密码至少 8 位" }, { status: 400 });
    if (password !== confirm)
      return NextResponse.json({ error: "两次密码不一致" }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, passwordHash } });
    await prisma.profile.create({ data: { userId: user.id } });
    await prisma.userSettings.create({ data: { userId: user.id, payload: {} } });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (err) {
    console.error("[register] failed", (err as Error).message);
    return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  }
}
