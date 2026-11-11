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
import { LeaveReviewActions } from "@/components/leave/leave-review-actions";
import { LeaveCancelDialog } from "@/components/leave/leave-cancel-dialog";
import { LeaveDetailsDialog } from "@/components/leave/leave-details-dialog";
import { LeaveCalendar } from "@/components/leave/leave-calendar";
import { adjustLeaveBalanceAction } from "./actions";
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
  FormDialog,
  type FormField,
  type SettingsValue,
} from "@/components/settings/settings-dialog";
import {
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Plus,
  Users,
} from "lucide-react";

const STATUSES = [
  "PENDING_MANAGER",
  "PENDING_HR",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;

type LeaveStatusFilter = (typeof STATUSES)[number];

export default async function LeavePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string; month?: string }>;
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
  const canReject = hasPermission(user, "leave.reject");
  const canRequest = hasPermission(user, "leave.request");
  const canManageBalance = hasPermission(user, "leave.manage_balance");
  const year = new Date().getUTCFullYear();
  const todayOnly = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
  );

  const reports = user.employeeId
    ? await prisma.employee.findMany({
        where: { managerId: user.employeeId, deletedAt: null },
        select: { id: true },
      })
    : [];
  const employeeIds = user.employeeId
    ? [user.employeeId, ...reports.map((report) => report.id)]
    : [];

  const statusFilter = STATUSES.includes(query.status as LeaveStatusFilter)
    ? (query.status as LeaveStatusFilter)
    : undefined;
  const search = query.q?.trim().slice(0, 100) || undefined;
  const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
  const defaultMonth = `${year}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
  const month = monthPattern.test(query.month ?? "") ? query.month! : defaultMonth;
  const [monthYear, monthNumber] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(monthYear, monthNumber - 1, 1));
  const monthEnd = new Date(Date.UTC(monthYear, monthNumber, 0));

  const visibleEmployeeFilter = canViewAll
    ? {}
    : { employeeId: { in: employeeIds.length ? employeeIds : ["__none__"] } };
  const searchFilter = search
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
    : {};

  const [
    leaveTypes,
    balances,
    requests,
    pendingCount,
    approvedDays,
    headcount,
    calendarRequests,
    employeeOptions,
  ] = await Promise.all([
    prisma.leaveType.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        nameAr: true,
        maxDaysPerYear: true,
        requiresApproval: true,
        requiresHrApproval: true,
        isPaid: true,
        color: true,
      },
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
        ...visibleEmployeeFilter,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...searchFilter,
      },
      select: {
        id: true,
        requestNo: true,
        employeeId: true,
        managerId: true,
        startDate: true,
        endDate: true,
        days: true,
        reason: true,
        status: true,
        managerComment: true,
        hrComment: true,
        managerReviewedAt: true,
        hrReviewedAt: true,
        approvedAt: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            firstNameAr: true,
            lastNameAr: true,
          },
        },
        leaveType: { select: { name: true, nameAr: true, color: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    }),
    prisma.leaveRequest.count({
      where: {
        status: { in: ["PENDING_MANAGER", "PENDING_HR"] },
        ...visibleEmployeeFilter,
      },
    }),
    prisma.leaveRequest.aggregate({
      where: {
        status: "APPROVED",
        startDate: { gte: new Date(Date.UTC(year, 0, 1)) },
        ...visibleEmployeeFilter,
      },
      _sum: { days: true },
    }),
    canViewAll
      ? prisma.employee.count({ where: { deletedAt: null } })
      : Promise.resolve(employeeIds.length),
    prisma.leaveRequest.findMany({
      where: {
        status: { in: ["PENDING_MANAGER", "PENDING_HR", "APPROVED"] },
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
        ...visibleEmployeeFilter,
      },
      select: {
        id: true,
        requestNo: true,
        startDate: true,
        endDate: true,
        status: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            firstNameAr: true,
            lastNameAr: true,
          },
        },
        leaveType: { select: { name: true, nameAr: true, color: true } },
      },
      orderBy: { startDate: "asc" },
      take: 200,
    }),
    canManageBalance
      ? prisma.employee.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            employeeNo: true,
            firstName: true,
            lastName: true,
            firstNameAr: true,
            lastNameAr: true,
          },
          orderBy: { firstName: "asc" },
          take: 500,
        })
      : Promise.resolve([]),
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
    employeeId: string;
  }) {
    if (!canApprove) return false;
    if (request.employeeId === user.employeeId) return false;
    if (request.status === "PENDING_MANAGER") {
      return canViewAll || user.employeeId === request.managerId;
    }
    if (request.status === "PENDING_HR") return canViewAll;
    return false;
  }

  function canCancel(request: {
    status: string;
    startDate: Date;
    employeeId: string;
  }) {
    if (request.status === "CANCELLED" || request.status === "REJECTED") {
      return false;
    }
    const isOwner = request.employeeId === user.employeeId;
    if (canManageBalance) return true;
    if (isOwner && request.status !== "APPROVED") return true;
    return isOwner && request.status === "APPROVED" && request.startDate > todayOnly;
  }

  function monthHref(offset: number) {
    const date = new Date(Date.UTC(monthYear, monthNumber - 1 + offset, 1));
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("q", search);
    params.set(
      "month",
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    );
    return `/leave?${params.toString()}`;
  }

  function statusLabel(status: string) {
    switch (status) {
      case "PENDING_MANAGER":
        return t("pendingManager");
      case "PENDING_HR":
        return t("pendingHr");
      case "APPROVED":
        return common("approved");
      case "REJECTED":
        return common("rejected");
      case "CANCELLED":
        return t("cancelled");
      default:
        return status;
    }
  }

  const balanceFields: FormField[] = [
    {
      name: "employeeId",
      label: t("employee"),
      type: "select",
      required: true,
      options: employeeOptions.map((employee) => ({
        value: employee.id,
        label: `${employee.employeeNo} · ${localizedName(
          locale,
          `${employee.firstName} ${employee.lastName}`,
          `${employee.firstNameAr ?? ""} ${employee.lastNameAr ?? ""}`.trim(),
        )}`,
      })),
      colSpan: 2,
    },
    {
      name: "leaveTypeId",
      label: t("leaveType"),
      type: "select",
      required: true,
      options: leaveTypes.map((leaveType) => ({
        value: leaveType.id,
        label: localizedName(locale, leaveType.name, leaveType.nameAr),
      })),
      colSpan: 2,
    },
    {
      name: "year",
      label: t("year"),
      type: "number",
      required: true,
      min: "2000",
      max: "2100",
      step: "1",
    },
    {
      name: "entitledDays",
      label: t("entitled"),
      type: "number",
      required: true,
      min: "0",
      max: "999",
      step: "0.5",
    },
    {
      name: "carriedDays",
      label: t("carried"),
      type: "number",
      required: true,
      min: "0",
      max: "999",
      step: "0.5",
    },
    {
      name: "usedAdjustment",
      label: t("usedAdjustment"),
      type: "number",
      required: true,
      min: "-999",
      max: "999",
      step: "0.5",
      help: t("usedAdjustmentHint"),
    },
  ];

  const balanceInitial: Record<string, SettingsValue> = {
    employeeId: user.employeeId ?? employeeOptions[0]?.id ?? "",
    leaveTypeId: leaveTypes[0]?.id ?? "",
    year: String(year),
    entitledDays: "0",
    carriedDays: "0",
    usedAdjustment: "0",
  };

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
          value={formatNumber(headcount, locale)}
          hint={t("teamRequests")}
          icon={<Users className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{canViewAll ? t("allRequests") : t("myRequests")}</CardTitle>
              <CardDescription>{t("subtitle")}</CardDescription>
            </div>
            <form className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <LiveSearch
                className="w-full sm:w-44"
                initialValue={search}
                placeholder={t("searchPlaceholder")}
                ariaLabel={t("searchPlaceholder")}
              />
              <select
                name="status"
                defaultValue={statusFilter ?? ""}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm sm:h-8 sm:w-auto sm:text-xs"
                aria-label={common("status")}
              >
                <option value="">{common("all")}</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
              <input type="hidden" name="month" value={month} />
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
              <>
                <div className="hidden md:block">
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
                      {requests.map((request) => {
                        const employeeName = localizedName(
                          locale,
                          `${request.employee.firstName} ${request.employee.lastName}`,
                          `${request.employee.firstNameAr ?? ""} ${request.employee.lastNameAr ?? ""}`.trim(),
                        );
                        const typeName = localizedName(
                          locale,
                          request.leaveType.name,
                          request.leaveType.nameAr,
                        );
                        const details = {
                          requestNo: request.requestNo,
                          employeeName,
                          leaveTypeName: typeName,
                          startDate: request.startDate.toISOString(),
                          endDate: request.endDate.toISOString(),
                          days: Number(request.days),
                          reason: request.reason,
                          status: request.status,
                          managerComment: request.managerComment,
                          hrComment: request.hrComment,
                          managerReviewedAt:
                            request.managerReviewedAt?.toISOString() ?? null,
                          hrReviewedAt: request.hrReviewedAt?.toISOString() ?? null,
                          approvedAt: request.approvedAt?.toISOString() ?? null,
                        };
                        return (
                          <TableRow key={request.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {request.requestNo}
                            </TableCell>
                            <TableCell>
                              <Link
                                href={`/employees/${request.employeeId}`}
                                className="text-sm font-medium hover:underline"
                              >
                                {employeeName}
                              </Link>
                            </TableCell>
                            <TableCell className="max-w-52">
                              <p className="text-sm">{typeName}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {request.reason}
                              </p>
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
                              <div className="flex flex-wrap justify-end gap-1">
                                <LeaveDetailsDialog locale={locale} details={details} />
                                {canReview(request) && (
                                  <LeaveReviewActions
                                    locale={locale}
                                    requestId={request.id}
                                    canApprove={canApprove}
                                    canReject={canReject}
                                  />
                                )}
                                {canCancel(request) && (
                                  <LeaveCancelDialog
                                    locale={locale}
                                    requestId={request.id}
                                    requestNo={request.requestNo}
                                  />
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="divide-y md:hidden">
                  {requests.map((request) => {
                    const employeeName = localizedName(
                      locale,
                      `${request.employee.firstName} ${request.employee.lastName}`,
                      `${request.employee.firstNameAr ?? ""} ${request.employee.lastNameAr ?? ""}`.trim(),
                    );
                    const typeName = localizedName(
                      locale,
                      request.leaveType.name,
                      request.leaveType.nameAr,
                    );
                    const details = {
                      requestNo: request.requestNo,
                      employeeName,
                      leaveTypeName: typeName,
                      startDate: request.startDate.toISOString(),
                      endDate: request.endDate.toISOString(),
                      days: Number(request.days),
                      reason: request.reason,
                      status: request.status,
                      managerComment: request.managerComment,
                      hrComment: request.hrComment,
                      managerReviewedAt:
                        request.managerReviewedAt?.toISOString() ?? null,
                      hrReviewedAt: request.hrReviewedAt?.toISOString() ?? null,
                      approvedAt: request.approvedAt?.toISOString() ?? null,
                    };
                    return (
                      <div key={request.id} className="space-y-2.5 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/employees/${request.employeeId}`}
                              className="block truncate text-sm font-semibold hover:underline"
                            >
                              {employeeName}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">
                              {request.requestNo} · {typeName}
                            </p>
                          </div>
                          <StatusBadge value={request.status} group="leaveStatus" />
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {formatDate(request.startDate, locale)} –{" "}
                            {formatDate(request.endDate, locale)}
                          </span>
                          <span>
                            {formatNumber(request.days, locale)} {t("days")}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs">{request.reason}</p>
                        <div className="flex flex-wrap items-center gap-1">
                          <LeaveDetailsDialog locale={locale} details={details} />
                          {canReview(request) && (
                            <LeaveReviewActions
                              locale={locale}
                              requestId={request.id}
                              canApprove={canApprove}
                              canReject={canReject}
                            />
                          )}
                          {canCancel(request) && (
                            <LeaveCancelDialog
                              locale={locale}
                              requestId={request.id}
                              requestNo={request.requestNo}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          {canRequest && (
            <Card id="new-request">
              <CardHeader>
                <CardTitle>{t("newRequest")}</CardTitle>
                <CardDescription>{t("workdaysHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                {leaveTypes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("noLeaveTypes")}</p>
                ) : (
                  <LeaveRequestForm
                    locale={locale}
                    leaveTypes={leaveTypes.map((leaveType) => ({
                      id: leaveType.id,
                      name: leaveType.name,
                      nameAr: leaveType.nameAr,
                      requiresHrApproval: leaveType.requiresHrApproval,
                      isPaid: leaveType.isPaid,
                      maxDaysPerYear: leaveType.maxDaysPerYear,
                    }))}
                  />
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>{t("balance")}</CardTitle>
                <CardDescription>
                  {t("year")} {year}
                </CardDescription>
              </div>
              {canManageBalance && leaveTypes.length > 0 && employeeOptions.length > 0 && (
                <FormDialog
                  title={t("adjustBalance")}
                  triggerLabel={t("adjustBalance")}
                  triggerSize="xs"
                  triggerVariant="outline"
                  successMessage={t("balanceAdjusted")}
                  fields={balanceFields}
                  initial={balanceInitial}
                  action={adjustLeaveBalanceAction.bind(null, locale)}
                  errorMessages={{
                    unauthorized: common("error"),
                    validation: t("invalidBalance"),
                    notFound: common("noResults"),
                    balanceExceeded: t("balanceExceeded"),
                  }}
                />
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {balances.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("noBalances")}</p>
              ) : (
                balances.map((balance) => {
                  const total =
                    Number(balance.entitledDays) + Number(balance.carriedDays);
                  const used = Number(balance.usedDays) + Number(balance.pendingDays);
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
                        <span className="shrink-0 text-muted-foreground">
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

      <LeaveCalendar
        locale={locale}
        month={month}
        prevHref={monthHref(-1)}
        nextHref={monthHref(1)}
        requests={calendarRequests.map((request) => ({
          id: request.id,
          requestNo: request.requestNo,
          employeeName: localizedName(
            locale,
            `${request.employee.firstName} ${request.employee.lastName}`,
            `${request.employee.firstNameAr ?? ""} ${request.employee.lastNameAr ?? ""}`.trim(),
          ),
          typeName: localizedName(
            locale,
            request.leaveType.name,
            request.leaveType.nameAr,
          ),
          color: request.leaveType.color,
          startDate: request.startDate.toISOString(),
          endDate: request.endDate.toISOString(),
          status: request.status,
        }))}
      />
    </div>
  );
}
