import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateTime, formatNumber, localizedName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";

const PAGE_SIZE = 30;

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ action?: string; entity?: string; page?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  await requirePermission("audit.view", locale);
  const t = await getTranslations({ locale, namespace: "audit" });
  const common = await getTranslations({ locale, namespace: "common" });

  const page = Math.max(1, Number(query.page ?? "1") || 1);
  const where = {
    ...(query.action ? { action: query.action as never } : {}),
    ...(query.entity ? { entity: { contains: query.entity, mode: "insensitive" as const } } : {}),
  };

  const [logs, total, entities] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
        ip: true,
        user: { select: { name: true, nameAr: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["entity"], _count: { _all: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const actions = [
    "LOGIN",
    "LOGOUT",
    "CREATE",
    "UPDATE",
    "DELETE",
    "APPROVE",
    "REJECT",
    "CALCULATE",
    "FINALIZE",
    "PASSWORD_CHANGE",
    "PERMISSION_CHANGE",
  ];

  function pageHref(nextPage: number) {
    const params = new URLSearchParams();
    if (query.action) params.set("action", query.action);
    if (query.entity) params.set("entity", query.entity);
    if (nextPage > 1) params.set("page", String(nextPage));
    const suffix = params.toString();
    return `/audit${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={<Badge variant="outline">{t("retentionHint")}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("title")}</p>
              <p className="text-xl font-semibold">{formatNumber(total, locale)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("entity")}</p>
            <p className="text-xl font-semibold">{formatNumber(entities.length, locale)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("timestamp")}</p>
            <p className="text-sm font-medium">{formatDateTime(logs[0]?.createdAt, locale)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </div>
          <form className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <select
              name="action"
              defaultValue={query.action ?? ""}
              className="h-8 rounded-md border bg-background px-2 text-xs"
              aria-label={t("filterAction")}
            >
              <option value="">{t("filterAction")}</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action.toLowerCase().replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <input
              name="entity"
              defaultValue={query.entity ?? ""}
              placeholder={t("filterEntity")}
              className="h-8 w-28 rounded-md border bg-background px-2 text-xs"
            />
            <Button type="submit" size="sm" variant="outline">
              {common("filter")}
            </Button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="p-6">
              <EmptyState title={t("noLogs")} />
            </div>
          ) : (
            <>
              <div className="divide-y md:hidden">
                {logs.map((log) => (
                  <div key={log.id} className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {log.user
                            ? localizedName(locale, log.user.name, log.user.nameAr)
                            : t("system")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(log.createdAt, locale)}
                        </p>
                      </div>
                      <StatusBadge value={log.action} group="auditAction" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{log.entity}</Badge>
                      {log.entityId && (
                        <span className="max-w-full truncate">{log.entityId}</span>
                      )}
                      {log.ip && <span>{log.ip}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("timestamp")}</TableHead>
                  <TableHead>{t("user")}</TableHead>
                  <TableHead>{t("action")}</TableHead>
                  <TableHead>{t("entity")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("entityId")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("ip")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(log.createdAt, locale)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.user
                        ? localizedName(locale, log.user.name, log.user.nameAr)
                        : t("system")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={log.action} group="auditAction" />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.entity}</Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-40 truncate text-xs text-muted-foreground md:table-cell">
                      {log.entityId ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {log.ip ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
                </Table>
              </div>
            </>
          )}
          <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {common("showing")} {formatNumber(Math.min((page - 1) * PAGE_SIZE + 1, total), locale)}–
              {formatNumber(Math.min(page * PAGE_SIZE, total), locale)} {common("of")}{" "}
              {formatNumber(total, locale)}
            </p>
            <div className="flex items-center gap-1">
              <Button asChild={page > 1} variant="outline" size="sm" disabled={page <= 1}>
                {page > 1 ? (
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeft className="size-4" />
                  </Link>
                ) : (
                  <span>
                    <ChevronLeft className="size-4" />
                  </span>
                )}
              </Button>
              <Badge variant="outline">
                {formatNumber(page, locale)} / {formatNumber(totalPages, locale)}
              </Badge>
              <Button
                asChild={page < totalPages}
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
              >
                {page < totalPages ? (
                  <Link href={pageHref(page + 1)}>
                    <ChevronRight className="size-4" />
                  </Link>
                ) : (
                  <span>
                    <ChevronRight className="size-4" />
                  </span>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
