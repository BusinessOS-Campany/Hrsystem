import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { CheckInCard } from "@/components/attendance/check-in-card";
import { reviewCorrectionFormAction } from "./actions";
import {
  formatDate,
  formatNumber,
  localizedName,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarCheck, Check, Clock3, UserCheck, X } from "lucide-react";

function time(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Aden",
  }).format(value);
}

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const user = await requirePermission("attendance.view", locale);
  const t = await getTranslations({ locale, namespace: "attendance" });
  const common = await getTranslations({ locale, namespace: "common" });
  const employeesT = await getTranslations({ locale, namespace: "employees" });

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const selectedDate = query.date ? new Date(`${query.date}T00:00:00.000Z`) : today;
  const canViewAll = hasPermission(user, "attendance.view_all");
  const canApprove = hasPermission(user, "attendance.approve");
  const canSelf = hasPermission(user, "attendance.self");

  const reports = user.employeeId
    ? await prisma.employee.findMany({
        where: { managerId: user.employeeId, deletedAt: null },
        select: { id: true },
      })
    : [];
  const employeeIds = user.employeeId
    ? [user.employeeId, ...reports.map((report) => report.id)]
    : [];
  const scope = canViewAll ? {} : { employeeId: { in: employeeIds.length ? employeeIds : ["__none__"] } };

  const monthStart = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth() + 1, 0));

  const [records, corrections, myRecord, monthly, monthlyOvertime] = await Promise.all([
    prisma.attendance.findMany({
      where: { date: selectedDate, ...scope },
      select: {
        id: true,
        employeeId: true,
        checkIn: true,
        checkOut: true,
        status: true,
        lateMinutes: true,
        workedMinutes: true,
        source: true,
        employee: {
          select: {
            employeeNo: true,
            firstName: true,
            lastName: true,
            firstNameAr: true,
            lastNameAr: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { employee: { firstName: "asc" } }],
    }),
    canApprove
      ? prisma.attendanceCorrection.findMany({
          where: {
            status: "PENDING",
            ...(canViewAll ? {} : { employeeId: { in: employeeIds.length ? employeeIds : ["__none__"] } }),
          },
          select: {
            id: true,
            date: true,
            reason: true,
            requestedCheckIn: true,
            requestedCheckOut: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
                firstNameAr: true,
                lastNameAr: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
    user.employeeId
      ? prisma.attendance.findUnique({
          where: { employeeId_date: { employeeId: user.employeeId, date: today } },
        })
      : Promise.resolve(null),
    user.employeeId
      ? prisma.attendance.groupBy({
          by: ["status"],
          where: {
            employeeId: user.employeeId,
            date: { gte: monthStart, lte: monthEnd },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    user.employeeId
      ? prisma.attendance.aggregate({
          where: {
            employeeId: user.employeeId,
            date: { gte: monthStart, lte: monthEnd },
          },
          _sum: { overtimeMinutes: true },
        })
      : Promise.resolve({ _sum: { overtimeMinutes: 0 } }),
  ]);

  const counts = Object.fromEntries(
    records.map((record) => [record.status, 0]),
  ) as Record<string, number>;
  for (const record of records) counts[record.status] = (counts[record.status] ?? 0) + 1;

  const mySummary = Object.fromEntries(monthly.map((row) => [row.status, row._count._all])) as Record<
    string,
    number
  >;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <form className="flex flex-wrap items-center gap-2">
            <Input type="date" name="date" defaultValue={selectedDate.toISOString().slice(0, 10)} className="w-auto" />
            <Button type="submit" variant="outline">
              {common("filter")}
            </Button>
          </form>
        }
      />

      {canSelf && user.employeeId && (
        <CheckInCard
          locale={locale}
          checkIn={myRecord?.checkIn?.toISOString() ?? null}
          checkOut={myRecord?.checkOut?.toISOString() ?? null}
          status={myRecord?.status ?? null}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("presentToday")}
          value={formatNumber((counts.PRESENT ?? 0) + (counts.LATE ?? 0) + (counts.REMOTE ?? 0), locale)}
          hint={formatDate(selectedDate, locale)}
          icon={<UserCheck className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("lateToday")}
          value={formatNumber(counts.LATE ?? 0, locale)}
          hint={t("late")}
          icon={<Clock3 className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("absentToday")}
          value={formatNumber(counts.ABSENT ?? 0, locale)}
          hint={t("absentToday")}
          icon={<X className="size-5" />}
          tone="danger"
        />
        <StatCard
          label={t("onLeaveToday")}
          value={formatNumber(counts.ON_LEAVE ?? 0, locale)}
          hint={t("onLeaveToday")}
          icon={<CalendarCheck className="size-5" />}
          tone="info"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{canViewAll ? t("allAttendance") : t("myAttendance")}</CardTitle>
              <CardDescription>
                {formatDate(selectedDate, locale)} · {formatNumber(records.length, locale)}{" "}
                {employeesT("title")}
              </CardDescription>
            </div>
            <Badge variant="outline">{selectedDate.toISOString().slice(0, 10)}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {records.length === 0 ? (
              <div className="p-6">
                <EmptyState title={t("noRecords")} />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("employee")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("checkInTime")}</TableHead>
                    <TableHead>{t("checkOutTime")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("worked")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("lateMinutes")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("source")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <Link
                          href={`/employees/${record.employeeId}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {localizedName(
                            locale,
                            `${record.employee.firstName} ${record.employee.lastName}`,
                            `${record.employee.firstNameAr ?? ""} ${record.employee.lastNameAr ?? ""}`.trim(),
                          )}
                        </Link>
                        <p className="text-xs text-muted-foreground">{record.employee.employeeNo}</p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={record.status} group="attendanceStatus" />
                      </TableCell>
                      <TableCell className="text-sm">{time(record.checkIn)}</TableCell>
                      <TableCell className="text-sm">{time(record.checkOut)}</TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {record.workedMinutes > 0
                          ? `${Math.floor(record.workedMinutes / 60)}h ${record.workedMinutes % 60}m`
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {record.lateMinutes > 0 ? `${record.lateMinutes}m` : "—"}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                        {record.source}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("monthlySummary")}</CardTitle>
            <CardDescription>{common("thisMonth")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <SummaryRow label={t("totalPresent")} value={mySummary.PRESENT ?? 0} locale={locale} />
            <SummaryRow label={t("totalLate")} value={mySummary.LATE ?? 0} locale={locale} />
            <SummaryRow label={t("totalAbsent")} value={mySummary.ABSENT ?? 0} locale={locale} />
            <SummaryRow
              label={t("totalOvertime")}
              value={Math.round(Number(monthlyOvertime._sum.overtimeMinutes ?? 0) / 60)}
              locale={locale}
            />
            <div className="border-t pt-2">
              <p className="text-xs text-muted-foreground">{t("workSchedule")}</p>
              <p className="font-medium">08:00 – 17:00</p>
              <p className="text-xs text-muted-foreground">{t("workDays")}: Sun – Thu</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {canApprove && corrections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("corrections")}</CardTitle>
            <CardDescription>{t("requestCorrection")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {corrections.map((correction) => (
              <div
                key={correction.id}
                className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {localizedName(
                      locale,
                      `${correction.employee.firstName} ${correction.employee.lastName}`,
                      `${correction.employee.firstNameAr ?? ""} ${correction.employee.lastNameAr ?? ""}`.trim(),
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(correction.date, locale)} · {correction.reason}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("requestedCheckIn")}: {time(correction.requestedCheckIn)} ·{" "}
                    {t("requestedCheckOut")}: {time(correction.requestedCheckOut)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={reviewCorrectionFormAction.bind(null, locale, correction.id, "APPROVED")}>
                    <Button size="sm" type="submit">
                      <Check className="size-4" /> {common("approve")}
                    </Button>
                  </form>
                  <form action={reviewCorrectionFormAction.bind(null, locale, correction.id, "REJECTED")}>
                    <Button size="sm" variant="outline" type="submit">
                      <X className="size-4" /> {common("reject")}
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  locale,
}: {
  label: string;
  value: number;
  locale: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{formatNumber(value, locale)}</span>
    </div>
  );
}
