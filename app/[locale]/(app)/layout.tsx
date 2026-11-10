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

  // One round trip for both the latest notifications and the unread badge.
  // A window count sees every unread row before LIMIT is applied.
  const notificationRows = await prisma.$queryRaw<
    Array<{
      id: string;
      title: string;
      titleAr: string | null;
      message: string;
      messageAr: string | null;
      link: string | null;
      isRead: boolean;
      createdAt: Date;
      unreadCount: bigint | number;
    }>
  >`
    SELECT id, title, "titleAr", message, "messageAr", link, "isRead", "createdAt",
           COUNT(*) FILTER (WHERE NOT "isRead") OVER () AS "unreadCount"
    FROM public.notifications
    WHERE "userId" = ${user.id}
    ORDER BY "createdAt" DESC
    LIMIT 8
  `;
  const unreadCount = Number(notificationRows[0]?.unreadCount ?? 0);
  const notifications = notificationRows.map((notification) => ({
    ...notification,
    createdAt: notification.createdAt.toISOString(),
  }));

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
        createdAt: notification.createdAt,
      }))}
    >
      {children}
    </AppShell>
  );
}
