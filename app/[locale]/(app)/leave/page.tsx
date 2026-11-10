import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LiveSearch } from "@/components/shared/live-search";
import { StatusBadge } from "@/components/shared/status-badge";
import { LeaveRequestForm } from "@/components/leave/leave-request-form";
import { reviewLeaveFormAction } from "./actions";
import { formatDate, formatNumber, localizedName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CalendarCheck,
  CalendarDays,
  Check,
  ClipboardList,
  Plus,
  Users,
  X,
} from "lucide-react";

export default async function LeavePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const user = await requirePermission("leave.view", locale);
  const t = await getTranslations({ locale, namespace: "leave" });
  const common = await getTranslations({ locale, namespace: "common" });
  const employeesT = await getTranslations({ locale, namespace: "employees" });

  const canViewAll = hasPermission(user, "leave.view_all");
  const canApprove = hasPermission(user, "leave.approve");
  const canRequest = hasPermission(user, "leave.request");
  const year = new Date().getUTCFullYear();

  const reports = user.employeeId
    ? await prisma.employee.findMany({
        where: { managerId: user.employeeId, deletedAt: null },
        select: { id: true },
      })
    : [];
  const employeeIds = user.employeeId
    ? [user.employeeId, ...reports.map((report) => report.id)]
    : [];

  const statusFilter = query.status;
  const search = query.q?.trim();
  const [leaveTypes, balances, requests, pendingCount, approvedDays] =
    await Promise.all([
      prisma.leaveType.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
      user.employeeId
        ? prisma.leaveBalance.findMany({
            where: { employeeId: user.employeeId, year },
            select: {
              id: true,
              entitledDays: true,
              carriedDays: true,
              usedDays: true,
              pendingDays: true,
              leaveType: { select: { code: true, name: true, nameAr: true } },
            },
            orderBy: { leaveType: { name: "asc" } },
          })
        : Promise.resolve([]),
      prisma.leaveRequest.findMany({
        where: {
          ...(canViewAll
            ? {}
            : { employeeId: { in: employeeIds.length ? employeeIds : ["__none__"] } }),
          ...(statusFilter
            ? { status: statusFilter as never }
            : {}),
          ...(search
            ? {
                OR: [
                  { requestNo: { contains: search, mode: "insensitive" as const } },
                  { reason: { contains: search, mode: "insensitive" as const } },
                  {
                    employee: {
                      OR: [
                        { firstName: { contains: search, mode: "insensitive" as const } },
                        { lastName: { contains: search, mode: "insensitive" as const } },
                        { employeeNo: { contains: search, mode: "insensitive" as const } },
                      ],
                    },
                  },
                  {
                    leaveType: {
                      OR: [
                        { name: { contains: search, mode: "insensitive" as const } },
                        { nameAr: { contains: search, mode: "insensitive" as const } },
                        { code: { contains: search, mode: "insensitive" as const } },
                      ],
                    },
                  },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          requestNo: true,
          employeeId: true,
          managerId: true,
          startDate: true,
          endDate: true,
          days: true,
          status: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
              firstNameAr: true,
              lastNameAr: true,
            },
          },
          leaveType: { select: { name: true, nameAr: true } },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 100,
      }),
      prisma.leaveRequest.count({
        where: {
          status: { in: ["PENDING_MANAGER", "PENDING_HR"] },
          ...(canViewAll
            ? {}
            : { employeeId: { in: employeeIds.length ? employeeIds : ["__none__"] } }),
        },
      }),
      prisma.leaveRequest.aggregate({
        where: {
          status: "APPROVED",
          startDate: { gte: new Date(Date.UTC(year, 0, 1)) },
          ...(canViewAll
            ? {}
            : { employeeId: { in: employeeIds.length ? employeeIds : ["__none__"] } }),
        },
        _sum: { days: true },
      }),
    ]);

  const annualBalance = balances.find((balance) => balance.leaveType.code === "ANNUAL");
  const annualRemaining = annualBalance
    ? Number(annualBalance.entitledDays) +
      Number(annualBalance.carriedDays) -
      Number(annualBalance.usedDays) -
      Number(annualBalance.pendingDays)
    : 0;
  const annualTotal = annualBalance
    ? Number(annualBalance.entitledDays) + Number(annualBalance.carriedDays)
    : 0;

  function canReview(request: {
    status: string;
    managerId: string | null;
  }) {
    if (!canApprove) return false;
    if (request.status === "PENDING_MANAGER") {
      return canViewAll || user.employeeId === request.managerId;
    }
    if (request.status === "PENDING_HR") return canViewAll;
    return false;
  }

  const statusOptions = [
    "PENDING_MANAGER",
    "PENDING_HR",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canRequest ? (
            <Button asChild size="sm">
              <Link href="#new-request">
                <Plus className="size-4" /> {t("newRequest")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("myBalance")}
          value={`${formatNumber(annualRemaining, locale)} ${t("days")}`}
          hint={`${t("entitled")}: ${formatNumber(annualTotal, locale)}`}
          icon={<CalendarDays className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("pending")}
          value={formatNumber(pendingCount, locale)}
          hint={t("managerReview")}
          icon={<ClipboardList className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("daysRequested")}
          value={formatNumber(Number(approvedDays._sum.days ?? 0), locale)}
          hint={t("approvedMsg")}
          icon={<CalendarCheck className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={employeesT("title")}
          value={formatNumber(employeeIds.length, locale)}
          hint={t("teamRequests")}
          icon={<Users className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{canViewAll ? t("allRequests") : t("myRequests")}</CardTitle>
              <CardDescription>{t("subtitle")}</CardDescription>
            </div>
            <form className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <LiveSearch
                className="w-full sm:w-44"
                initialValue={search}
                placeholder={t("searchPlaceholder")}
                ariaLabel={t("searchPlaceholder")}
              />
              <select
                name="status"
                defaultValue={statusFilter ?? ""}
                className="h-8 rounded-md border bg-background px-2 text-xs"
                aria-label={common("status")}
              >
                <option value="">{common("all")}</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.toLowerCase().replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" type="submit">
                {common("filter")}
              </Button>
            </form>
          </CardHeader>
          <CardContent className="p-0">
            {requests.length === 0 ? (
              <div className="p-6">
                <EmptyState title={t("noRequests")} />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("requestNo")}</TableHead>
                    <TableHead>{employeesT("fullName")}</TableHead>
                    <TableHead>{t("leaveType")}</TableHead>
                    <TableHead>{t("startDate")}</TableHead>
                    <TableHead>{t("days")}</TableHead>
                    <TableHead>{common("status")}</TableHead>
                    <TableHead className="text-end">{common("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {request.requestNo}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/employees/${request.employeeId}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {localizedName(
                            locale,
                            `${request.employee.firstName} ${request.employee.lastName}`,
                            `${request.employee.firstNameAr ?? ""} ${request.employee.lastNameAr ?? ""}`.trim(),
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {localizedName(
                          locale,
                          request.leaveType.name,
                          request.leaveType.nameAr,
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(request.startDate, locale)} –{" "}
                        {formatDate(request.endDate, locale)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {formatNumber(request.days, locale)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={request.status} group="leaveStatus" />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {canReview(request) ? (
                            <>
                              <form
                                action={reviewLeaveFormAction.bind(
                                  null,
                                  locale,
                                  request.id,
                                  "APPROVED",
                                )}
                              >
                                <Button size="sm" type="submit">
                                  <Check className="size-3.5" />
                                  <span className="sr-only sm:not-sr-only">
                                    {common("approve")}
                                  </span>
                                </Button>
                              </form>
                              <form
                                action={reviewLeaveFormAction.bind(
                                  null,
                                  locale,
                                  request.id,
                                  "REJECTED",
                                )}
                              >
                                <Button size="sm" variant="outline" type="submit">
                                  <X className="size-3.5" />
                                  <span className="sr-only sm:not-sr-only">
                                    {common("reject")}
                                  </span>
                                </Button>
                              </form>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {canRequest && (
            <Card id="new-request">
              <CardHeader>
                <CardTitle>{t("newRequest")}</CardTitle>
                <CardDescription>{t("workdaysHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                {leaveTypes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("noLeaveTypes")}
                  </p>
                ) : (
                  <LeaveRequestForm locale={locale} leaveTypes={leaveTypes} />
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t("balance")}</CardTitle>
              <CardDescription>
                {t("year")} {year}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {balances.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("noBalances")}</p>
              ) : (
                balances.map((balance) => {
                  const total =
                    Number(balance.entitledDays) + Number(balance.carriedDays);
                  const used =
                    Number(balance.usedDays) + Number(balance.pendingDays);
                  const remaining = total - used;
                  return (
                    <div key={balance.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium">
                          {localizedName(
                            locale,
                            balance.leaveType.name,
                            balance.leaveType.nameAr,
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {formatNumber(remaining, locale)} /{" "}
                          {formatNumber(total, locale)}
                        </span>
                      </div>
                      <Progress
                        value={total > 0 ? (used / total) * 100 : 0}
                        className="h-1.5"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {t("used")}: {formatNumber(balance.usedDays, locale)} ·{" "}
                        {t("pending")}: {formatNumber(balance.pendingDays, locale)}
                      </p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
