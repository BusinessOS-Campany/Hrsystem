import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { PrintButton } from "@/components/reports/print-button";
import {
  formatDate,
  formatMoney,
  formatNumber,
  localizedName,
  startOfMonth,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  CircleDollarSign,
  Download,
  TrendingDown,
  Users,
} from "lucide-react";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission("report.view", locale);
  const t = await getTranslations({ locale, namespace: "reports" });
  const common = await getTranslations({ locale, namespace: "common" });
  const employeesT = await getTranslations({ locale, namespace: "employees" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const now = new Date();
  const year = now.getUTCFullYear();
  const monthStart = startOfMonth(now);
  const yearStart = new Date(Date.UTC(year, 0, 1));

  const [employees, attendance, leaveByType, latestRun, vacancies, applications, courses, assets] =
    await Promise.all([
      prisma.employee.findMany({
        where: { deletedAt: null },
        include: {
          employments: {
            where: { isCurrent: true },
            include: { department: true },
            take: 1,
          },
        },
      }),
      prisma.attendance.groupBy({
        by: ["status"],
        where: { date: { gte: monthStart } },
        _count: { _all: true },
      }),
      prisma.leaveRequest.findMany({
        where: { status: "APPROVED", startDate: { gte: yearStart } },
        include: { leaveType: true },
      }),
      prisma.payrollRun.findFirst({
        orderBy: [{ period: { startDate: "desc" } }],
        include: { period: true },
      }),
      prisma.jobVacancy.findMany({ where: { status: "OPEN" } }),
      prisma.candidateApplication.groupBy({
        by: ["stage"],
        _count: { _all: true },
      }),
      prisma.trainingCourse.findMany({
        include: { _count: { select: { enrollments: true } } },
      }),
      prisma.asset.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
    ]);

  const active = employees.filter((employee) =>
    ["ACTIVE", "PROBATION", "ON_LEAVE"].includes(employee.status),
  );
  const leavers = employees.filter(
    (employee) =>
      ["RESIGNED", "TERMINATED", "RETIRED"].includes(employee.status) &&
      employee.terminationDate &&
      employee.terminationDate >= yearStart,
  );
  const turnoverRate = active.length + leavers.length > 0
    ? (leavers.length / (active.length + leavers.length)) * 100
    : 0;

  const departmentMap = new Map<string, { name: string; nameAr: string; count: number }>();
  for (const employee of active) {
    const employment = employee.employments[0];
    if (!employment) continue;
    const current = departmentMap.get(employment.departmentId) ?? {
      name: employment.department.name,
      nameAr: employment.department.nameAr,
      count: 0,
    };
    current.count += 1;
    departmentMap.set(employment.departmentId, current);
  }
  const departments = [...departmentMap.values()].sort((a, b) => b.count - a.count);

  const attendanceCounts = Object.fromEntries(
    attendance.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;
  const attendanceTotal = Object.values(attendanceCounts).reduce((sum, value) => sum + value, 0);
  const attendanceRate =
    attendanceTotal > 0
      ? ((attendanceCounts.PRESENT ?? 0) + (attendanceCounts.LATE ?? 0)) / attendanceTotal
      : 0;

  const leaveMap = new Map<string, { name: string; nameAr: string; days: number }>();
  for (const request of leaveByType) {
    const current = leaveMap.get(request.leaveTypeId) ?? {
      name: request.leaveType.name,
      nameAr: request.leaveType.nameAr,
      days: 0,
    };
    current.days += Number(request.days);
    leaveMap.set(request.leaveTypeId, current);
  }
  const leaveTypes = [...leaveMap.values()].sort((a, b) => b.days - a.days);

  const enrolled = courses.reduce((sum, course) => sum + course._count.enrollments, 0);
  const totalAssets = assets.reduce((sum, asset) => sum + asset._count._all, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PrintButton />
            <Button asChild variant="outline" size="sm">
              <a href="/api/reports/employees" download>
                <Download className="size-4" /> {t("download")}
              </a>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("headcount")}
          value={formatNumber(active.length, locale)}
          hint={`${formatNumber(employees.length, locale)} ${employeesT("title")}`}
          icon={<Users className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("turnoverRate")}
          value={`${turnoverRate.toFixed(1)}%`}
          hint={`${formatNumber(leavers.length, locale)} ${t("turnoverHint")}`}
          icon={<TrendingDown className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("attendanceRate")}
          value={`${Math.round(attendanceRate * 100)}%`}
          hint={common("thisMonth")}
          icon={<CalendarCheck className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("payrollCost")}
          value={latestRun ? formatMoney(latestRun.totalNet, locale, "YER") : "—"}
          hint={latestRun ? latestRun.period.name : t("noData")}
          icon={<CircleDollarSign className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("monthlyHeadcount")}</CardTitle>
            <CardDescription>{t("department")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {departments.length === 0 ? (
              <EmptyState title={t("noData")} />
            ) : (
              departments.map((department) => (
                <div key={department.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {localizedName(locale, department.name, department.nameAr)}
                    </span>
                    <span className="font-medium">{formatNumber(department.count, locale)}</span>
                  </div>
                  <Progress
                    value={active.length > 0 ? (department.count / active.length) * 100 : 0}
                    className="h-1.5"
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("leaveUtilization")}</CardTitle>
            <CardDescription>
              {common("thisYear")} · {year}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {leaveTypes.length === 0 ? (
              <EmptyState title={t("noData")} />
            ) : (
              leaveTypes.map((type) => (
                <div key={type.name} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
                  <span className="truncate">
                    {localizedName(locale, type.name, type.nameAr)}
                  </span>
                  <Badge variant="secondary">
                    {formatNumber(type.days, locale)} {common("date")}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("recruitmentReport")}</CardTitle>
            <CardDescription>{nav("recruitment")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("summary")}</TableHead>
                  <TableHead>{common("total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>{t("employeeReport")}</TableCell>
                  <TableCell>{formatNumber(vacancies.length, locale)}</TableCell>
                </TableRow>
                {applications.map((stage) => (
                  <TableRow key={stage.stage}>
                    <TableCell>
                      <StatusBadge value={stage.stage} group="applicationStage" />
                    </TableCell>
                    <TableCell>{formatNumber(stage._count._all, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("trainingReport")}</CardTitle>
            <CardDescription>{nav("training")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("trainingReport")}</span>
              <span className="font-medium">{formatNumber(courses.length, locale)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{nav("training")}</span>
              <span className="font-medium">{formatNumber(enrolled, locale)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("assetsReport")}</span>
              <span className="font-medium">{formatNumber(totalAssets, locale)}</span>
            </div>
            <div className="border-t pt-3">
              <p className="mb-2 text-xs text-muted-foreground">{t("exportNote")}</p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href="/api/reports/employees" download>
                  <Download className="size-4" /> {t("employeeDirectory")}
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("generatedAt")}: {formatDate(now, locale)} · {t("printHint")}
      </p>
    </div>
  );
}
