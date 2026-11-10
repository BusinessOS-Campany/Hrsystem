import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  AttendanceTrendChart,
  DepartmentChart,
  LeaveTypeChart,
} from "@/components/dashboard/lazy-charts";
import {
  addDays,
  dateKey,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  localizedName,
  startOfMonth,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Cake,
  CircleDollarSign,
  Clock3,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requirePermission("dashboard.view", locale);

  const t = await getTranslations({ locale, namespace: "dashboard" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const common = await getTranslations({ locale, namespace: "common" });
  const employeesT = await getTranslations({ locale, namespace: "employees" });

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = startOfMonth(today);
  const in60Days = addDays(today, 60);
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));

  const activeStatuses = ["ACTIVE", "PROBATION", "ON_LEAVE"] as const;
  const activeStatusList = [...activeStatuses];
  const onLeaveWhere = {
    status: "APPROVED" as const,
    startDate: { lte: today },
    endDate: { gte: today },
  };

  const [
    statusCounts,
    newHires,
    attendanceToday,
    onLeaveCount,
    onLeavePreview,
    pendingLeave,
    pendingRequests,
    openVacancies,
    expiringContracts,
    payrollRuns,
    attendanceRows,
    leaveTotals,
    leaveTypes,
    auditLogs,
    departmentCounts,
    departments,
    birthdaysRaw,
  ] = await Promise.all([
    prisma.employee.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.employee.count({
      where: { deletedAt: null, hireDate: { gte: monthStart } },
    }),
    prisma.attendance.groupBy({
      by: ["status"],
      where: { date: today },
      _count: { _all: true },
    }),
    prisma.leaveRequest.count({ where: onLeaveWhere }),
    prisma.leaveRequest.findMany({
      where: onLeaveWhere,
      select: { employee: { select: { firstName: true } } },
      orderBy: { startDate: "asc" },
      take: 2,
    }),
    prisma.leaveRequest.count({
      where: { status: { in: ["PENDING_MANAGER", "PENDING_HR"] } },
    }),
    prisma.employeeRequest.count({ where: { status: "PENDING" } }),
    prisma.jobVacancy.count({ where: { status: "OPEN" } }),
    prisma.employment.findMany({
      where: {
        isCurrent: true,
        contractEnd: { gte: today, lte: in60Days },
      },
      select: {
        id: true,
        contractEnd: true,
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { contractEnd: "asc" },
      take: 6,
    }),
    prisma.payrollRun.findMany({
      orderBy: [{ period: { startDate: "desc" } }, { createdAt: "desc" }],
      select: {
        employeeCount: true,
        totalGross: true,
        totalNet: true,
        status: true,
        period: { select: { name: true } },
      },
      take: 2,
    }),
    prisma.attendance.groupBy({
      by: ["date", "status"],
      where: { date: { gte: addDays(today, -21) } },
      _count: { _all: true },
      orderBy: { date: "asc" },
    }),
    prisma.leaveRequest.groupBy({
      by: ["leaveTypeId"],
      where: { status: "APPROVED", startDate: { gte: yearStart } },
      _sum: { days: true },
      orderBy: { _sum: { days: "desc" } },
      take: 6,
    }),
    prisma.leaveType.findMany({
      where: { isActive: true },
      select: { id: true, name: true, nameAr: true, color: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        action: true,
        entity: true,
        createdAt: true,
        user: { select: { name: true, nameAr: true } },
      },
    }),
    prisma.employment.groupBy({
      by: ["departmentId"],
      where: {
        isCurrent: true,
        employee: { deletedAt: null, status: { in: activeStatusList } },
      },
      _count: { _all: true },
      orderBy: { _count: { departmentId: "desc" } },
      take: 7,
    }),
    prisma.department.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, nameAr: true },
    }),
    prisma.$queryRaw<
      Array<{
        id: string;
        firstName: string;
        lastName: string;
        firstNameAr: string | null;
        lastNameAr: string | null;
        bmonth: number;
        bday: number;
      }>
    >`
      WITH active AS (
        SELECT id, "firstName", "lastName", "firstNameAr", "lastNameAr",
          EXTRACT(MONTH FROM "dateOfBirth")::int AS bmonth,
          EXTRACT(DAY FROM "dateOfBirth")::int AS bday,
          to_char("dateOfBirth", 'MM-DD') AS bmd
        FROM employees
        WHERE "deletedAt" IS NULL
          AND status IN ('ACTIVE', 'PROBATION', 'ON_LEAVE')
          AND "dateOfBirth" IS NOT NULL
      ), bounds AS (
        SELECT to_char(CURRENT_DATE, 'MM-DD') AS today_md,
               to_char(CURRENT_DATE + INTERVAL '30 days', 'MM-DD') AS end_md
      )
      SELECT a.id, a."firstName", a."lastName", a."firstNameAr", a."lastNameAr",
             a.bmonth, a.bday
      FROM active a CROSS JOIN bounds b
      WHERE (b.today_md <= b.end_md AND a.bmd BETWEEN b.today_md AND b.end_md)
         OR (b.today_md > b.end_md AND (a.bmd >= b.today_md OR a.bmd <= b.end_md))
      ORDER BY CASE WHEN a.bmd >= b.today_md THEN 0 ELSE 1 END, a.bmd
      LIMIT 4
    `,
  ]);

  const statusCountMap = Object.fromEntries(
    statusCounts.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;
  const headcount = activeStatuses.reduce(
    (sum, status) => sum + (statusCountMap[status] ?? 0),
    0,
  );

  const attendanceCounts = Object.fromEntries(
    attendanceToday.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;
  const present = attendanceCounts.PRESENT ?? 0;
  const late = attendanceCounts.LATE ?? 0;
  const absent = attendanceCounts.ABSENT ?? 0;
  const attendanceTotal = present + late + absent + (attendanceCounts.ON_LEAVE ?? 0);
  const presentRate = attendanceTotal > 0 ? Math.round(((present + late) / attendanceTotal) * 100) : 0;

  const departmentMap = new Map(
    departments.map((department) => [department.id, department]),
  );
  const departmentStats = departmentCounts.flatMap((row) => {
    const department = departmentMap.get(row.departmentId);
    if (!department) return [];
    return [{
      name: localizedName(locale, department.name, department.nameAr),
      value: row._count._all,
    }];
  });

  const trendMap = new Map<string, { present: number; late: number; absent: number }>();
  for (const row of attendanceRows) {
    const key = dateKey(row.date);
    const bucket = trendMap.get(key) ?? { present: 0, late: 0, absent: 0 };
    const count = row._count._all;
    if (row.status === "PRESENT") bucket.present += count;
    if (row.status === "LATE") bucket.late += count;
    if (row.status === "ABSENT") bucket.absent += count;
    trendMap.set(key, bucket);
  }
  const attendanceTrend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([date, values]) => ({
      date: new Intl.DateTimeFormat(locale === "ar" ? "ar-YE-u-ca-gregory-nu-latn" : "en-GB", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(`${date}T00:00:00.000Z`)),
      ...values,
    }));

  const leaveTypeMap = new Map(leaveTypes.map((type) => [type.id, type]));
  const leaveByType = leaveTotals.flatMap((row) => {
    const type = leaveTypeMap.get(row.leaveTypeId);
    if (!type) return [];
    return [{
      name: localizedName(locale, type.name, type.nameAr),
      value: Number(row._sum.days ?? 0),
      color: type.color ?? "#2563eb",
    }];
  });

  const birthdays = birthdaysRaw.map((row) => {
    let next = new Date(Date.UTC(today.getUTCFullYear(), row.bmonth - 1, row.bday));
    if (next < today) {
      next = new Date(Date.UTC(today.getUTCFullYear() + 1, row.bmonth - 1, row.bday));
    }
    return {
      employee: {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        firstNameAr: row.firstNameAr,
        lastNameAr: row.lastNameAr,
      },
      next,
    };
  });

  const latestRun = payrollRuns[0] ?? null;
  const previousRun = payrollRuns[1] ?? null;
  const latestNet = Number(latestRun?.totalNet ?? 0);
  const latestGross = Number(latestRun?.totalGross ?? 0);
  const previousNet = Number(previousRun?.totalNet ?? 0);
  const payrollDelta =
    previousNet > 0 ? Math.round(((latestNet - previousNet) / previousNet) * 100) : 0;

  const can = (permission: string) => hasPermission(user, permission);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("welcomeBack", { name: localizedName(locale, user.name, user.nameAr) })}
        description={`${formatDate(today, locale)} · ${t("welcomeHint")}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {can("employee.create") && (
              <Button asChild size="sm" variant="outline">
                <Link href="/employees/new">
                  <UserPlus className="size-4" /> {t("addEmployee")}
                </Link>
              </Button>
            )}
            {can("payroll.create") && (
              <Button asChild size="sm" variant="outline">
                <Link href="/payroll">
                  <Wallet className="size-4" /> {t("runPayroll")}
                </Link>
              </Button>
            )}
            {can("leave.approve") && (
              <Button asChild size="sm">
                <Link href="/leave">
                  <ClipboardCheck className="size-4" /> {t("approveLeave")}
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("totalEmployees")}
          value={formatNumber(headcount, locale)}
          hint={`${formatNumber(headcount, locale)} ${common("active")}`}
          icon={<Users className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("todayAttendance")}
          value={formatNumber(present + late, locale)}
          hint={`${formatNumber(late, locale)} ${t("late")} · ${formatNumber(absent, locale)} ${t("absent")}`}
          icon={<UserCheck className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("onLeave")}
          value={formatNumber(onLeaveCount, locale)}
          hint={onLeavePreview
            .map((request) => request.employee.firstName)
            .join("، ")}
          icon={<CalendarDays className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("pendingRequests")}
          value={formatNumber(pendingLeave + pendingRequests, locale)}
          hint={`${formatNumber(pendingLeave, locale)} ${nav("leave")} · ${formatNumber(pendingRequests, locale)} ${nav("requests")}`}
          icon={<ClipboardCheck className="size-5" />}
          tone="danger"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("newEmployees")}
          value={formatNumber(newHires, locale)}
          hint={common("thisMonth")}
          icon={<UserPlus className="size-5" />}
        />
        <StatCard
          label={t("openVacancies")}
          value={formatNumber(openVacancies, locale)}
          hint={nav("recruitment")}
          icon={<ArrowUpRight className="size-5" />}
        />
        <StatCard
          label={t("contractExpirations")}
          value={formatNumber(expiringContracts.length, locale)}
          hint={t("contracts")}
          icon={<CalendarClock className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("netPayroll")}
          value={latestRun ? formatMoney(latestNet, locale, "YER") : "—"}
          hint={
            latestRun
              ? `${latestRun.period.name} · ${payrollDelta >= 0 ? "+" : ""}${payrollDelta}%`
              : t("noPayroll")
          }
          icon={<CircleDollarSign className="size-5" />}
          tone="positive"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{t("attendanceTrend")}</CardTitle>
              <CardDescription>{t("todaySnapshot")}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/attendance">
                {common("view")} <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {attendanceTrend.length === 0 ? (
              <EmptyState title={common("noResults")} />
            ) : (
              <AttendanceTrendChart
                data={attendanceTrend}
                locale={locale}
                labels={{ present: t("present"), late: t("late"), absent: t("absent") }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("departmentStats")}</CardTitle>
            <CardDescription>{t("headcount")}</CardDescription>
          </CardHeader>
          <CardContent>
            {departmentStats.length === 0 ? (
              <EmptyState title={common("noResults")} />
            ) : (
              <DepartmentChart data={departmentStats} locale={locale} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{t("payrollSummary")}</CardTitle>
              <CardDescription>{t("thisMonthPayroll")}</CardDescription>
            </div>
            <Wallet className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            {latestRun ? (
              <>
                <div className="space-y-1">
                  <p className="text-2xl font-semibold tracking-tight">
                    {formatMoney(latestNet, locale, "YER")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {latestRun.period.name} · {formatNumber(latestRun.employeeCount, locale)}{" "}
                    {employeesT("title")}
                  </p>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("grossPayroll")}</span>
                    <span className="font-medium">{formatMoney(latestGross, locale, "YER")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("netPayroll")}</span>
                    <span className="font-medium">{formatMoney(latestNet, locale, "YER")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{common("status")}</span>
                    <StatusBadge value={latestRun.status} group="payrollStatus" />
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/payroll">{t("viewReports")}</Link>
                </Button>
              </>
            ) : (
              <EmptyState title={t("noPayroll")} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("leaveByType")}</CardTitle>
            <CardDescription>{common("thisYear")}</CardDescription>
          </CardHeader>
          <CardContent>
            {leaveByType.length === 0 ? (
              <EmptyState title={common("noResults")} />
            ) : (
              <div className="space-y-2">
                <LeaveTypeChart data={leaveByType} locale={locale} />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {leaveByType.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate text-muted-foreground">{item.name}</span>
                      <span className="ms-auto font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("upcoming")}</CardTitle>
            <CardDescription>{t("workforce")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Cake className="size-3.5" /> {t("upcomingBirthdays")}
              </p>
              {birthdays.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("noBirthdays")}</p>
              ) : (
                birthdays.map(({ employee, next }) => (
                  <div key={employee.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link
                      href={`/employees/${employee.id}`}
                      className="truncate hover:underline"
                    >
                      {localizedName(locale, `${employee.firstName} ${employee.lastName}`, `${employee.firstNameAr ?? ""} ${employee.lastNameAr ?? ""}`.trim())}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(next, locale, { year: undefined })}
                    </span>
                  </div>
                ))
              )}
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <CalendarClock className="size-3.5" /> {t("contractExpirations")}
              </p>
              {expiringContracts.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("noExpiries")}</p>
              ) : (
                expiringContracts.slice(0, 3).map((contract) => (
                  <div key={contract.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {contract.employee.firstName} {contract.employee.lastName}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(contract.contractEnd, locale)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{t("latestActivity")}</CardTitle>
              <CardDescription>{nav("audit")}</CardDescription>
            </div>
            {can("audit.view") && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/audit">
                  {common("view")} <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <EmptyState title={t("noActivity")} />
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Clock3 className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <span className="font-medium">
                          {localizedName(locale, log.user?.name, log.user?.nameAr) || common("system")}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {log.action.toLowerCase()} · {log.entity}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(log.createdAt, locale)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("quickActions")}</CardTitle>
            <CardDescription>{t("welcomeHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {can("employee.create") && (
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/employees/new">
                  <UserPlus className="size-4" /> {t("addEmployee")}
                </Link>
              </Button>
            )}
            {can("payroll.create") && (
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/payroll">
                  <Wallet className="size-4" /> {t("runPayroll")}
                </Link>
              </Button>
            )}
            {can("recruitment.create") && (
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/recruitment">
                  <ArrowUpRight className="size-4" /> {t("postVacancy")}
                </Link>
              </Button>
            )}
            {can("leave.request") && (
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/leave">
                  <CalendarDays className="size-4" /> {nav("leave")}
                </Link>
              </Button>
            )}
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("todayAttendance")}</span>
                <span className="font-medium">{presentRate}%</span>
              </div>
              <Progress value={presentRate} className="mt-2 h-1.5" />
              <p className="mt-2 text-[11px] text-muted-foreground">
                {formatNumber(present + late, locale)} / {formatNumber(attendanceTotal, locale)}{" "}
                {t("present")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
