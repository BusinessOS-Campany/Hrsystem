"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { hashPassword, passwordIssues } from "@/lib/auth/password";
import { writeAudit } from "@/lib/auth/audit";

export type UserActionResult = {
  ok: boolean;
  error?:
    | "unauthorized"
    | "validation"
    | "duplicate"
    | "notFound"
    | "selfEdit"
    | "lastAdmin"
    | "invalidRole"
    | "employeeTaken"
    | "weakPassword";
};

const baseUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  nameAr: z.string().trim().max(120).optional(),
  isActive: z.boolean().default(true),
  mustChangePassword: z.boolean().default(true),
  roleCodes: z.string().min(1),
});

const createUserSchema = baseUserSchema.extend({
  username: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/),
  email: z.string().trim().email().max(160),
  password: z.string().min(1).max(200),
  employeeId: z.string().trim().optional(),
});

const updateUserSchema = baseUserSchema.extend({
  password: z.string().max(200).optional(),
});

function parseRoleCodes(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((code) => code.trim())
        .filter(Boolean),
    ),
  ];
}

async function resolveRoles(actorIsSuper: boolean, roleCodes: string[]) {
  if (roleCodes.length === 0) return { error: "invalidRole" as const };
  if (!actorIsSuper && roleCodes.includes("SUPER_ADMIN")) {
    return { error: "invalidRole" as const };
  }
  const roles = await prisma.role.findMany({ where: { code: { in: roleCodes } } });
  if (roles.length !== roleCodes.length) return { error: "invalidRole" as const };
  return { roles };
}

function revalidateUsers(locale: string) {
  revalidatePath(`/${locale}/users`);
  revalidatePath(`/${locale}/settings`);
  revalidatePath(`/${locale}/dashboard`);
}

export async function createUserAction(
  locale: string,
  input: unknown,
): Promise<UserActionResult> {
  const actor = await getCurrentUser();
  if (!actor || !hasPermission(actor, "user.manage")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const data = parsed.data;
  const roleCodes = parseRoleCodes(data.roleCodes);
  const actorIsSuper = actor.roles.some((role) => role.code === "SUPER_ADMIN");
  const roleResult = await resolveRoles(actorIsSuper, roleCodes);
  if ("error" in roleResult) return { ok: false, error: roleResult.error };

  const issues = passwordIssues(data.password);
  if (issues.length > 0) return { ok: false, error: "weakPassword" };

  const username = data.username.trim();
  const email = data.email.toLowerCase();
  const duplicate = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { id: true },
  });
  if (duplicate) return { ok: false, error: "duplicate" };

  const employeeId =
    data.employeeId && data.employeeId !== "__none__" ? data.employeeId : null;
  if (employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true, user: { select: { id: true } } },
    });
    if (!employee) return { ok: false, error: "notFound" };
    if (employee.user) return { ok: false, error: "employeeTaken" };
  }

  const passwordHash = await hashPassword(data.password);
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.name,
        nameAr: data.nameAr || null,
        username,
        email,
        passwordHash,
        isActive: data.isActive,
        mustChangePassword: data.mustChangePassword,
        employeeId,
      },
    });
    await tx.userRole.createMany({
      data: roleResult.roles.map((role) => ({ userId: user.id, roleId: role.id })),
      skipDuplicates: true,
    });
    return user;
  });

  await writeAudit({
    userId: actor.id,
    action: "CREATE",
    entity: "User",
    entityId: created.id,
    newData: {
      username: created.username,
      email: created.email,
      roles: roleCodes,
      employeeId,
      isActive: created.isActive,
    },
  });

  revalidateUsers(locale);
  return { ok: true };
}

export async function updateUserAction(
  locale: string,
  userId: string,
  input: unknown,
): Promise<UserActionResult> {
  const actor = await getCurrentUser();
  if (!actor || !hasPermission(actor, "user.manage")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  if (!target || target.deletedAt) return { ok: false, error: "notFound" };
  if (target.id === actor.id) return { ok: false, error: "selfEdit" };

  const data = parsed.data;
  const roleCodes = parseRoleCodes(data.roleCodes);
  const actorIsSuper = actor.roles.some((role) => role.code === "SUPER_ADMIN");
  const targetIsSuper = target.roles.some((userRole) => userRole.role.code === "SUPER_ADMIN");
  if (!actorIsSuper && targetIsSuper) return { ok: false, error: "unauthorized" };

  const roleResult = await resolveRoles(actorIsSuper, roleCodes);
  if ("error" in roleResult) return { ok: false, error: roleResult.error };

  const willBeSuper = roleCodes.includes("SUPER_ADMIN");
  if (targetIsSuper && (!willBeSuper || !data.isActive)) {
    const otherActiveSupers = await prisma.userRole.count({
      where: {
        role: { code: "SUPER_ADMIN" },
        user: { isActive: true, deletedAt: null, id: { not: userId } },
      },
    });
    if (otherActiveSupers === 0) return { ok: false, error: "lastAdmin" };
  }

  const password = data.password?.trim() || null;
  if (password) {
    const issues = passwordIssues(password);
    if (issues.length > 0) return { ok: false, error: "weakPassword" };
  }
  const passwordHash = password ? await hashPassword(password) : null;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        nameAr: data.nameAr || null,
        isActive: data.isActive,
        mustChangePassword: data.mustChangePassword,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
    await tx.userRole.deleteMany({ where: { userId } });
    await tx.userRole.createMany({
      data: roleResult.roles.map((role) => ({ userId, roleId: role.id })),
      skipDuplicates: true,
    });
    if (passwordHash) {
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  });

  await writeAudit({
    userId: actor.id,
    action: passwordHash ? "PASSWORD_CHANGE" : "UPDATE",
    entity: "User",
    entityId: userId,
    oldData: {
      roles: target.roles.map((userRole) => userRole.role.code),
      isActive: target.isActive,
    },
    newData: {
      roles: roleCodes,
      isActive: data.isActive,
      passwordChanged: Boolean(passwordHash),
    },
  });

  revalidateUsers(locale);
  return { ok: true };
}
