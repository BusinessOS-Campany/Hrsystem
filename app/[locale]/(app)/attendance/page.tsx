import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { CheckInCard } from "@/components/attendance/check-in-card";
import { CorrectionReviewActions } from "@/components/attendance/correction-review-actions";
import { requestCorrectionAction } from "./actions";
import {
  FormDialog,
  type FormField,
  type SettingsValue,
} from "@/components/settings/settings-dialog";
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
import { CalendarCheck, Clock3, UserCheck, X } from "lucide-react";

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
            ...(canViewAll
              ? user.employeeId
                ? { employeeId: { not: user.employeeId } }
                : {}
              : {
                  employeeId: {
                    in: employeeIds.filter((id) => id !== user.employeeId),
                  },
                }),
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

  const correctionFields: FormField[] = [
    {
      name: "date",
      label: t("date"),
      type: "date",
      required: true,
      max: today.toISOString().slice(0, 10),
    },
    {
      name: "checkIn",
      label: t("requestedCheckIn"),
      type: "time",
    },
    {
      name: "checkOut",
      label: t("requestedCheckOut"),
      type: "time",
    },
    {
      name: "reason",
      label: t("correctionReason"),
      type: "textarea",
      required: true,
      colSpan: 2,
    },
  ];
  const correctionInitial: Record<string, SettingsValue> = {
    date: today.toISOString().slice(0, 10),
    checkIn: "",
    checkOut: "",
    reason: "",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <form className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                name="date"
                defaultValue={selectedDate.toISOString().slice(0, 10)}
                className="w-auto"
              />
              <Button type="submit" size="sm" variant="outline">
                {common("filter")}
              </Button>
            </form>
            {canSelf && user.employeeId && (
              <FormDialog
                title={t("requestCorrection")}
                triggerLabel={t("requestCorrection")}
                triggerVariant="outline"
                triggerSize="sm"
                successMessage={t("correctionSubmitted")}
                fields={correctionFields}
                initial={correctionInitial}
                action={requestCorrectionAction.bind(null, locale)}
                errorMessages={{
                  invalid: t("invalidCorrection"),
                  duplicate: t("correctionDuplicate"),
                  noEmployee: common("error"),
                  unauthorized: common("error"),
                }}
              />
            )}
          </div>
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
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("employee")}</TableHead>
                        <TableHead>{t("status")}</TableHead>
                        <TableHead>{t("checkInTime")}</TableHead>
                        <TableHead>{t("checkOutTime")}</TableHead>
                        <TableHead>{t("worked")}</TableHead>
                        <TableHead>{t("lateMinutes")}</TableHead>
                        <TableHead>{t("source")}</TableHead>
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
                            <p className="text-xs text-muted-foreground">
                              {record.employee.employeeNo}
                            </p>
                          </TableCell>
                          <TableCell>
                            <StatusBadge value={record.status} group="attendanceStatus" />
                          </TableCell>
                          <TableCell className="text-sm">{time(record.checkIn)}</TableCell>
                          <TableCell className="text-sm">{time(record.checkOut)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {record.workedMinutes > 0
                              ? `${Math.floor(record.workedMinutes / 60)}h ${record.workedMinutes % 60}m`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {record.lateMinutes > 0 ? `${record.lateMinutes}m` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {record.source}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="divide-y md:hidden">
                  {records.map((record) => (
                    <div key={record.id} className="space-y-2 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/employees/${record.employeeId}`}
                            className="block truncate text-sm font-semibold hover:underline"
                          >
                            {localizedName(
                              locale,
                              `${record.employee.firstName} ${record.employee.lastName}`,
                              `${record.employee.firstNameAr ?? ""} ${record.employee.lastNameAr ?? ""}`.trim(),
                            )}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {record.employee.employeeNo}
                          </p>
                        </div>
                        <StatusBadge value={record.status} group="attendanceStatus" />
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <span className="text-muted-foreground">
                          {t("checkInTime")}: <span className="text-foreground">{time(record.checkIn)}</span>
                        </span>
                        <span className="text-muted-foreground">
                          {t("checkOutTime")}: <span className="text-foreground">{time(record.checkOut)}</span>
                        </span>
                        <span className="text-muted-foreground">
                          {t("worked")}:{" "}
                          <span className="text-foreground">
                            {record.workedMinutes > 0
                              ? `${Math.floor(record.workedMinutes / 60)}h ${record.workedMinutes % 60}m`
                              : "—"}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          {t("lateMinutes")}:{" "}
                          <span className="text-foreground">
                            {record.lateMinutes > 0 ? `${record.lateMinutes}m` : "—"}
                          </span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
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
                <CorrectionReviewActions locale={locale} correctionId={correction.id} />
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
