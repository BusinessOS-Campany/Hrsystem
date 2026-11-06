import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { markAllNotificationsReadAction, markNotificationReadAction } from "./actions";
import { formatDateTime, localizedName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, CheckCheck, Circle } from "lucide-react";

export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const user = await requirePermission("notification.view", locale);
  const t = await getTranslations({ locale, namespace: "notifications" });
  const common = await getTranslations({ locale, namespace: "common" });

  const unreadOnly = query.filter === "unread";
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={unreadOnly ? "/notifications" : "/notifications?filter=unread"}>
                {unreadOnly ? common("all") : t("unread")} ({unreadCount})
              </Link>
            </Button>
            {unreadCount > 0 && (
              <form action={markAllNotificationsReadAction.bind(null, locale)}>
                <Button type="submit" size="sm">
                  <CheckCheck className="size-4" /> {t("markAllRead")}
                </Button>
              </form>
            )}
          </div>
        }
      />

      <div className="space-y-2">
        {notifications.length === 0 ? (
          <EmptyState
            title={t("noNotifications")}
            description={t("emptyHint")}
            icon={<Bell className="size-5" />}
          />
        ) : (
          notifications.map((notification) => (
            <Card
              key={notification.id}
              className={notification.isRead ? "opacity-80" : "border-primary/20"}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div
                  className={
                    notification.isRead
                      ? "mt-1 text-muted-foreground"
                      : "mt-1 text-primary"
                  }
                >
                  <Circle className="size-2.5 fill-current" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {localizedName(
                        locale,
                        notification.title,
                        notification.titleAr,
                      )}
                    </p>
                    {!notification.isRead && (
                      <Badge variant="secondary" className="text-[10px]">
                        {t("new")}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {localizedName(
                      locale,
                      notification.message,
                      notification.messageAr,
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDateTime(notification.createdAt, locale)}</span>
                    {notification.link && (
                      <Link
                        href={notification.link}
                        className="text-primary hover:underline"
                      >
                        {common("view")}
                      </Link>
                    )}
                    {!notification.isRead && (
                      <form
                        action={markNotificationReadAction.bind(
                          null,
                          locale,
                          notification.id,
                        )}
                      >
                        <button
                          type="submit"
                          className="text-primary hover:underline"
                        >
                          {t("allRead")}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
