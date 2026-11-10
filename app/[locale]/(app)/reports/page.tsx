import type { EmploymentStatus } from "@prisma/client";
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

  const activeStatusList: EmploymentStatus[] = ["ACTIVE", "PROBATION", "ON_LEAVE"];
  const [
    statusCounts,
    leaversCount,
    departmentCountsRaw,
    departmentRows,
    attendance,
    leaveTotals,
    leaveTypeRows,
    latestRun,
    openVacancies,
    applications,
    courseCount,
    enrollmentCount,
    assets,
  ] = await Promise.all([
    prisma.employee.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.employee.count({
      where: {
        deletedAt: null,
        status: { in: ["RESIGNED", "TERMINATED", "RETIRED"] },
        terminationDate: { gte: yearStart },
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
    }),
    prisma.department.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, nameAr: true },
    }),
    prisma.attendance.groupBy({
      by: ["status"],
      where: { date: { gte: monthStart } },
      _count: { _all: true },
    }),
    prisma.leaveRequest.groupBy({
      by: ["leaveTypeId"],
      where: { status: "APPROVED", startDate: { gte: yearStart } },
      _sum: { days: true },
      orderBy: { _sum: { days: "desc" } },
    }),
    prisma.leaveType.findMany({
      select: { id: true, name: true, nameAr: true },
    }),
    prisma.payrollRun.findFirst({
      orderBy: [{ period: { startDate: "desc" } }],
      select: { totalNet: true, period: { select: { name: true } } },
    }),
    prisma.jobVacancy.count({ where: { status: "OPEN" } }),
    prisma.candidateApplication.groupBy({
      by: ["stage"],
      _count: { _all: true },
    }),
    prisma.trainingCourse.count(),
    prisma.trainingEnrollment.count(),
    prisma.asset.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const departmentCounts = departmentCountsRaw as Array<{
    departmentId: string;
    _count: { _all: number };
  }>;
  const statusCountMap = Object.fromEntries(
    statusCounts.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;
  const activeCount = activeStatusList.reduce(
    (sum, status) => sum + (statusCountMap[status] ?? 0),
    0,
  );
  const totalEmployees = statusCounts.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );
  const turnoverRate = activeCount + leaversCount > 0
    ? (leaversCount / (activeCount + leaversCount)) * 100
    : 0;

  const departmentMap = new Map(
    departmentRows.map((department) => [department.id, department]),
  );
  const departments = departmentCounts.flatMap((row) => {
    const department = departmentMap.get(row.departmentId);
    if (!department) return [];
    return [{
      name: department.name,
      nameAr: department.nameAr,
      count: row._count._all,
    }];
  });

  const attendanceCounts = Object.fromEntries(
    attendance.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;
  const attendanceTotal = Object.values(attendanceCounts).reduce((sum, value) => sum + value, 0);
  const attendanceRate =
    attendanceTotal > 0
      ? ((attendanceCounts.PRESENT ?? 0) + (attendanceCounts.LATE ?? 0)) / attendanceTotal
      : 0;

  const leaveTypeMap = new Map(leaveTypeRows.map((type) => [type.id, type]));
  const leaveTypes = leaveTotals.flatMap((row) => {
    const type = leaveTypeMap.get(row.leaveTypeId);
    if (!type) return [];
    return [{
      name: type.name,
      nameAr: type.nameAr,
      days: Number(row._sum.days ?? 0),
    }];
  });

  const enrolled = enrollmentCount;
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
          value={formatNumber(activeCount, locale)}
          hint={`${formatNumber(totalEmployees, locale)} ${employeesT("title")}`}
          icon={<Users className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("turnoverRate")}
          value={`${turnoverRate.toFixed(1)}%`}
          hint={`${formatNumber(leaversCount, locale)} ${t("turnoverHint")}`}
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
                    value={activeCount > 0 ? (department.count / activeCount) * 100 : 0}
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
                  <TableCell>{formatNumber(openVacancies, locale)}</TableCell>
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
              <span className="font-medium">{formatNumber(courseCount, locale)}</span>
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
