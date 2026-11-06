"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";

export type LoginState = {
  error?: "invalid" | "locked" | "inactive" | "validation" | "server";
};

export async function loginAction(input: unknown): Promise<LoginState> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: "validation" };

  const { identifier, password, locale, next } = parsed.data;
  const h = await headers();

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { username: identifier },
        ],
        deletedAt: null,
      },
    });

    if (!user) return { error: "invalid" };
    if (!user.isActive) return { error: "inactive" };
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return { error: "locked" };
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil:
            attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
      return { error: attempts >= 5 ? "locked" : "invalid" };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await createSession(user.id, {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    await writeAudit({
      userId: user.id,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: h.get("user-agent"),
    });
  } catch (error) {
    console.error("Login failed", error);
    return { error: "server" };
  }

  const target =
    next && next.startsWith(`/${locale}/`) ? next : `/${locale}/dashboard`;
  redirect(target);
}
