"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, destroyCurrentSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { writeAudit } from "@/lib/auth/audit";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

export type ActionResult<T = undefined> = {
  ok: boolean;
  error?: string;
  data?: T;
};

export async function logoutAction(locale: string) {
  const user = await getCurrentUser();
  const h = await headers();
  await destroyCurrentSession();
  if (user) {
    await writeAudit({
      userId: user.id,
      action: "LOGOUT",
      entity: "User",
      entityId: user.id,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: h.get("user-agent"),
    });
  }
  redirect(`/${locale}/login`);
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) return { ok: false, error: "unauthorized" };

  const valid = await verifyPassword(parsed.data.currentPassword, record.passwordHash);
  if (!valid) return { ok: false, error: "currentPassword" };

  const passwordHash = await hashPassword(parsed.data.password);
  const h = await headers();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.session.updateMany({
      where: { userId: user.id, id: { not: user.sessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await writeAudit({
    userId: user.id,
    action: "PASSWORD_CHANGE",
    entity: "User",
    entityId: user.id,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: h.get("user-agent"),
  });

  return { ok: true };
}

export async function forgotPasswordAction(
  input: unknown,
): Promise<ActionResult<{ resetUrl?: string }>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const user = await prisma.user.findFirst({
    where: { email: parsed.data.email.toLowerCase(), isActive: true, deletedAt: null },
  });

  // Never reveal whether an account exists.
  if (!user) return { ok: true, data: {} };

  const token = generateToken();
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const base = process.env.APP_URL ?? "http://localhost:3000";
  const resetUrl = `${base}/${parsed.data.locale}/reset-password?token=${token}`;

  // In production this link is emailed by a transactional email provider.
  if (process.env.NODE_ENV !== "production") {
    console.info(`[HRSYS] Password reset link for ${user.email}: ${resetUrl}`);
  }

  return {
    ok: true,
    data: { resetUrl: process.env.NODE_ENV !== "production" ? resetUrl : undefined },
  };
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const tokenHash = hashToken(parsed.data.token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, error: "resetInvalid" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const h = await headers();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await writeAudit({
    userId: record.userId,
    action: "PASSWORD_CHANGE",
    entity: "User",
    entityId: record.userId,
    newData: { source: "reset_link" },
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: h.get("user-agent"),
  });

  return { ok: true };
}

export async function revokeSessionAction(sessionId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (sessionId === user.sessionId) return { ok: false, error: "currentSession" };

  const result = await prisma.session.updateMany({
    where: { id: sessionId, userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (result.count === 0) return { ok: false, error: "notFound" };
  return { ok: true };
}
