import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";

export default async function AuthenticatedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireAuth(locale);

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  return (
    <AppShell
      user={{
        name: user.name,
        nameAr: user.nameAr,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
      }}
      unreadCount={unreadCount}
      notifications={notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        titleAr: notification.titleAr,
        message: notification.message,
        messageAr: notification.messageAr,
        link: notification.link,
        isRead: notification.isRead,
        createdAt: notification.createdAt.toISOString(),
      }))}
    >
      {children}
    </AppShell>
  );
}
