import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
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
import {
  Banknote,
  CircleDollarSign,
  ReceiptText,
  Users,
  Wallet,
} from "lucide-react";

export default async function PayrollPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requirePermission("payroll.view", locale);
  const t = await getTranslations({ locale, namespace: "payroll" });
  const common = await getTranslations({ locale, namespace: "common" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const employeesT = await getTranslations({ locale, namespace: "employees" });

  const canViewAll = hasPermission(user, "payroll.view_all");
  const canViewSelf = hasPermission(user, "payroll.view_self") || Boolean(user.employeeId);

  const [runs, myItems, periods, components] = await Promise.all([
    canViewAll
      ? prisma.payrollRun.findMany({
          orderBy: [{ period: { startDate: "desc" } }, { createdAt: "desc" }],
          include: { period: true, _count: { select: { items: true } } },
          take: 24,
        })
      : Promise.resolve([]),
    user.employeeId && canViewSelf
      ? prisma.payrollItem.findMany({
          where: { employeeId: user.employeeId },
          include: { run: { include: { period: true } } },
          orderBy: { createdAt: "desc" },
          take: 12,
        })
      : Promise.resolve([]),
    prisma.payrollPeriod.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 6,
      include: { _count: { select: { runs: true } } },
    }),
    prisma.salaryComponent.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const latest = runs[0];
  const totalNet = runs.reduce((sum, run) => sum + Number(run.totalNet), 0);
  const averageNet = runs.length > 0 ? totalNet / runs.length : 0;
  const latestMy = myItems[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            {hasPermission(user, "payroll.manage_components") && (
              <Button asChild variant="outline" size="sm">
                <Link href="/settings#salary-components">{t("components")}</Link>
              </Button>
            )}
            {hasPermission(user, "payroll.create") && (
              <Button size="sm" asChild>
                <Link href="/payroll/runs/new">
                  <Wallet className="size-4" /> {t("createRun")}
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("totalNet")}
          value={latest ? formatMoney(latest.totalNet, locale, "YER") : "—"}
          hint={latest ? latest.period.name : t("noRuns")}
          icon={<CircleDollarSign className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("totalGross")}
          value={latest ? formatMoney(latest.totalGross, locale, "YER") : "—"}
          hint={latest ? `${formatNumber(latest.employeeCount, locale)} ${employeesT("title")}` : ""}
          icon={<Banknote className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("averageNet")}
          value={formatMoney(averageNet, locale, "YER")}
          hint={t("runs")}
          icon={<ReceiptText className="size-5" />}
        />
        <StatCard
          label={t("myPayslips")}
          value={latestMy ? formatMoney(latestMy.netSalary, locale, latestMy.currency) : "—"}
          hint={latestMy ? latestMy.run.period.name : t("noPayslips")}
          icon={<Users className="size-5" />}
          tone="warning"
        />
      </div>

      {canViewAll && (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{t("runs")}</CardTitle>
              <CardDescription>{t("statusFlow")}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {["DRAFT", "CALCULATED", "REVIEW", "APPROVED", "FINALIZED", "PAID"].map(
                (step, index) => (
                  <div key={step} className="hidden items-center gap-2 xl:flex">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {step.toLowerCase()}
                    </span>
                    {index < 5 && <span className="h-px w-4 bg-border" />}
                  </div>
                ),
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {runs.length === 0 ? (
              <div className="p-6">
                <EmptyState title={t("noRuns")} />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("runNo")}</TableHead>
                    <TableHead>{t("period")}</TableHead>
                    <TableHead>{t("employeeCount")}</TableHead>
                    <TableHead>{t("gross")}</TableHead>
                    <TableHead>{t("deductions")}</TableHead>
                    <TableHead>{t("net")}</TableHead>
                    <TableHead>{common("status")}</TableHead>
                    <TableHead className="text-end">{common("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {run.runNo}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{run.period.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(run.period.payDate, locale)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatNumber(run.employeeCount, locale)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          / {formatNumber(run._count.items, locale)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatMoney(run.totalGross, locale, "YER")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatMoney(run.totalDeductions, locale, "YER")}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatMoney(run.totalNet, locale, "YER")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={run.status} group="payrollStatus" />
                      </TableCell>
                      <TableCell className="text-end">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/payroll/${run.id}`}>{common("view")}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className={canViewAll ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader>
            <CardTitle>{t("myPayslips")}</CardTitle>
            <CardDescription>{t("myPayslipsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {myItems.length === 0 ? (
              <div className="p-6">
                <EmptyState title={t("noPayslips")} />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("period")}</TableHead>
                    <TableHead>{t("basicSalary")}</TableHead>
                    <TableHead>{t("gross")}</TableHead>
                    <TableHead>{t("deductions")}</TableHead>
                    <TableHead>{t("net")}</TableHead>
                    <TableHead>{common("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm font-medium">
                        {item.run.period.name}
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
                      <TableCell>
                        <StatusBadge value={item.run.status} group="payrollStatus" />
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
            <CardTitle>{t("periods")}</CardTitle>
            <CardDescription>{nav("payroll")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {periods.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noOpenPeriod")}</p>
            ) : (
              periods.map((period) => (
                <div
                  key={period.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">{period.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(period.startDate, locale)} –{" "}
                      {formatDate(period.endDate, locale)}
                    </p>
                  </div>
                  <Badge variant="outline">{period.status}</Badge>
                </div>
              ))
            )}
            {components.length > 0 && (
              <div className="border-t pt-2">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {t("components")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {components.slice(0, 8).map((component) => (
                    <span
                      key={component.id}
                      className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {locale === "ar" ? component.nameAr : component.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
