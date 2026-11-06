import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import {
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
  generateToken,
  hashToken,
  sessionExpiry,
} from "./tokens";

export type AuthUser = {
  id: string;
  name: string;
  nameAr: string | null;
  email: string;
  username: string;
  employeeId: string | null;
  roles: { code: string; name: string; nameAr: string }[];
  permissions: string[];
  sessionId: string;
};

const userInclude = {
  user: {
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  },
} as const;

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: userInclude,
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    !session.user.isActive ||
    session.user.deletedAt
  ) {
    return null;
  }

  const roles = session.user.roles.map((ur) => ({
    code: ur.role.code,
    name: ur.role.name,
    nameAr: ur.role.nameAr,
  }));
  const permissions = [
    ...new Set(
      session.user.roles.flatMap((ur) =>
        ur.role.permissions.map((rp) => rp.permission.code),
      ),
    ),
  ];

  return {
    id: session.user.id,
    name: session.user.name,
    nameAr: session.user.nameAr,
    email: session.user.email,
    username: session.user.username,
    employeeId: session.user.employeeId,
    roles,
    permissions,
    sessionId: session.id,
  };
});

export async function requireAuth(locale: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }
  return user;
}

export async function requirePermission(
  permission: string,
  locale: string,
): Promise<AuthUser> {
  const user = await requireAuth(locale);
  if (!hasPermission(user, permission)) {
    redirect(`/${locale}/forbidden`);
  }
  return user;
}

export function hasPermission(
  user: Pick<AuthUser, "permissions"> | null,
  permission: string,
) {
  return Boolean(user?.permissions.includes(permission));
}

export function hasAnyPermission(
  user: Pick<AuthUser, "permissions"> | null,
  permissions: string[],
) {
  return permissions.some((p) => hasPermission(user, p));
}

export function isAdmin(user: Pick<AuthUser, "roles"> | null) {
  return Boolean(
    user?.roles.some((r) => ["SUPER_ADMIN", "HR_ADMIN"].includes(r.code)),
  );
}

export async function createSession(
  userId: string,
  meta: { ip?: string; userAgent?: string } = {},
) {
  const token = generateToken();
  const expiresAt = sessionExpiry(SESSION_TTL_DAYS);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  store.delete(SESSION_COOKIE);
}

export async function revokeSession(userId: string, sessionId: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
