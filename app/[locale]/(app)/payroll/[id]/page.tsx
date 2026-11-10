import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { approveRunFormAction, finalizeRunFormAction } from "../actions";
import { formatDate, formatDateTime, formatMoney, formatNumber, localizedName } from "@/lib/format";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, CheckCircle2, CircleDollarSign, Users, Wallet } from "lucide-react";

export default async function PayrollRunPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requirePermission("payroll.view", locale);
  if (!hasPermission(user, "payroll.view_all")) notFound();

  const t = await getTranslations({ locale, namespace: "payroll" });
  const common = await getTranslations({ locale, namespace: "common" });
  const employeesT = await getTranslations({ locale, namespace: "employees" });

  const run = await prisma.payrollRun.findUnique({
    where: { id },
    select: {
      id: true,
      runNo: true,
      status: true,
      employeeCount: true,
      calculatedAt: true,
      finalizedAt: true,
      totalGross: true,
      totalDeductions: true,
      totalNet: true,
      period: { select: { name: true, startDate: true, endDate: true } },
      approvedBy: { select: { name: true, nameAr: true } },
      items: {
        select: {
          id: true,
          employeeId: true,
          basicSalary: true,
          grossSalary: true,
          totalDeductions: true,
          netSalary: true,
          currency: true,
          employee: {
            select: {
              employeeNo: true,
              firstName: true,
              lastName: true,
              firstNameAr: true,
              lastNameAr: true,
              employments: {
                where: { isCurrent: true },
                select: {
                  department: { select: { name: true, nameAr: true } },
                },
                take: 1,
              },
            },
          },
        },
        orderBy: { employee: { employeeNo: "asc" } },
      },
    },
  });

  if (!run) notFound();

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ms-2">
        <Link href="/payroll">
          <ArrowLeft className="size-4" /> {common("back")}
        </Link>
      </Button>

      <PageHeader
        title={`${t("runNo")} ${run.runNo}`}
        description={`${run.period.name} · ${formatDate(run.period.startDate, locale)} – ${formatDate(run.period.endDate, locale)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={run.status} group="payrollStatus" />
            {["CALCULATED", "REVIEW"].includes(run.status) &&
              hasPermission(user, "payroll.approve") && (
                <form action={approveRunFormAction.bind(null, locale, run.id)}>
                  <Button type="submit">{t("approve")}</Button>
                </form>
              )}
            {run.status === "APPROVED" && hasPermission(user, "payroll.finalize") && (
              <form action={finalizeRunFormAction.bind(null, locale, run.id)}>
                <Button type="submit">
                  <CheckCircle2 className="size-4" /> {t("finalize")}
                </Button>
              </form>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("totalGross")}
          value={formatMoney(run.totalGross, locale, "YER")}
          icon={<CircleDollarSign className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("deductions")}
          value={formatMoney(run.totalDeductions, locale, "YER")}
          icon={<Wallet className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("totalNet")}
          value={formatMoney(run.totalNet, locale, "YER")}
          icon={<CircleDollarSign className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("employeeCount")}
          value={formatNumber(run.employeeCount, locale)}
          hint={`${formatNumber(run.items.length, locale)} ${t("payslips")}`}
          icon={<Users className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t("payslips")}</CardTitle>
            <CardDescription>{t("salaryBreakdown")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {run.items.length === 0 ? (
              <div className="p-6">
                <EmptyState title={t("noPayslips")} />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{employeesT("fullName")}</TableHead>
                    <TableHead>{employeesT("department")}</TableHead>
                    <TableHead>{t("basicSalary")}</TableHead>
                    <TableHead>{t("gross")}</TableHead>
                    <TableHead>{t("deductions")}</TableHead>
                    <TableHead>{t("net")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {run.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          href={`/employees/${item.employeeId}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {localizedName(
                            locale,
                            `${item.employee.firstName} ${item.employee.lastName}`,
                            `${item.employee.firstNameAr ?? ""} ${item.employee.lastNameAr ?? ""}`.trim(),
                          )}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {item.employee.employeeNo}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.employee.employments[0]
                          ? localizedName(
                              locale,
                              item.employee.employments[0].department.name,
                              item.employee.employments[0].department.nameAr,
                            )
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatMoney(item.basicSalary, locale, item.currency)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatMoney(item.grossSalary, locale, item.currency)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatMoney(item.totalDeductions, locale, item.currency)}
                      </TableCell>
                      <TableCell className="text-sm font-semibold">
                        {formatMoney(item.netSalary, locale, item.currency)}
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
            <CardTitle>{t("statusFlow")}</CardTitle>
            <CardDescription>{run.period.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{common("status")}</span>
              <StatusBadge value={run.status} group="payrollStatus" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t("calculatedAt")}</span>
              <span className="text-xs">{formatDateTime(run.calculatedAt, locale)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t("approvedBy")}</span>
              <span className="text-xs">
                {run.approvedBy
                  ? localizedName(locale, run.approvedBy.name, run.approvedBy.nameAr)
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t("finalizedAt")}</span>
              <span className="text-xs">{formatDateTime(run.finalizedAt, locale)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t("period")}</span>
              <span className="text-xs">
                {formatDate(run.period.startDate, locale)} –{" "}
                {formatDate(run.period.endDate, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t("currency")}</span>
              <span className="text-xs">YER</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
