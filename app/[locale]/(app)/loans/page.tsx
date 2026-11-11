import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  FormDialog,
  type FormField,
  type FormValue,
} from "@/components/settings/settings-dialog";
import { formatDate, formatMoney, formatNumber, localizedName } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
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
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  Wallet,
} from "lucide-react";
import {
  payInstallmentAction,
  requestLoanAction,
  reviewLoanAction,
} from "./actions";

const PAGE_SIZE = 20;

export default async function LoansPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const user = await requirePermission("loan.view", locale);
  const t = await getTranslations({ locale, namespace: "loans" });
  const common = await getTranslations({ locale, namespace: "common" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const canApprove = hasPermission(user, "loan.approve");
  const canRequest = hasPermission(user, "loan.request") && Boolean(user.employeeId);
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const scope = canApprove
    ? {}
    : { employeeId: user.employeeId ?? "__none__" };

  const total = await prisma.employeeLoan.count({ where: scope });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const [loans, statusCounts, outstanding, pendingInstallments] =
    await Promise.all([
      prisma.employeeLoan.findMany({
        where: scope,
        select: {
          id: true,
          loanNo: true,
          employeeId: true,
          amount: true,
          installmentAmount: true,
          installments: true,
          balance: true,
          startDate: true,
          status: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
              firstNameAr: true,
              lastNameAr: true,
            },
          },
          approvedBy: { select: { name: true, nameAr: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.employeeLoan.groupBy({
        by: ["status"],
        where: scope,
        _count: { _all: true },
      }),
      prisma.employeeLoan.aggregate({
        where: { ...scope, status: "ACTIVE" },
        _sum: { balance: true },
      }),
      prisma.loanInstallment.count({
        where: { status: "PENDING", loan: { status: "ACTIVE", ...scope } },
      }),
    ]);

  const countFor = (status: string) =>
    statusCounts.find((item) => item.status === status)?._count._all ?? 0;
  const pendingTotal = countFor("PENDING");
  const activeTotal = countFor("ACTIVE");

  const upcoming = await prisma.loanInstallment.findMany({
    where: { status: "PENDING", loan: { status: "ACTIVE", ...scope } },
    select: {
      id: true,
      dueDate: true,
      amount: true,
      status: true,
      loan: {
        select: {
          id: true,
          loanNo: true,
          employeeId: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
              firstNameAr: true,
              lastNameAr: true,
            },
          },
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 12,
  });

  function pageHref(target: number) {
    return `/loans?page=${target}`;
  }

  const errorMessages = {
    noEmployee: t("noEmployee"),
    invalidDate: t("invalidDate"),
    pendingExists: t("pendingExists"),
    notPending: t("notPending"),
    notActive: t("notActive"),
    alreadyPaid: t("alreadyPaid"),
    selfApproval: t("selfApproval"),
    conflict: t("notPending"),
    notFound: common("noResults"),
    unauthorized: common("error"),
    validation: common("requiredField"),
  };

  function requestFields(): FormField[] {
    return [
      {
        name: "amount",
        label: t("amount"),
        type: "number",
        min: "0.01",
        max: "1000000",
        step: "0.01",
        required: true,
      },
      {
        name: "installments",
        label: t("installments"),
        type: "number",
        min: "1",
        max: "60",
        step: "1",
        required: true,
      },
      { name: "startDate", label: t("startDate"), type: "date", required: true },
      {
        name: "reason",
        label: common("reason"),
        type: "textarea",
        required: true,
        colSpan: 2,
      },
    ];
  }

  function requestInitial(): Record<string, FormValue> {
    return {
      amount: "",
      installments: "12",
      startDate: new Date().toISOString().slice(0, 10),
      reason: "",
    };
  }

  function LoanActions({ loan }: { loan: (typeof loans)[number] }) {
    if (!canApprove) return null;
    return (
      <div className="flex flex-wrap items-center gap-1">
        {loan.status === "PENDING" && (
          <>
            <FormDialog
              title={t("approveLoan")}
              description={loan.loanNo}
              triggerLabel={common("approve")}
              successMessage={t("approvedMsg")}
              fields={[]}
              initial={{}}
              action={reviewLoanAction.bind(
                null,
                locale,
                loan.id,
                "APPROVED",
              )}
              errorMessages={errorMessages}
              triggerSize="xs"
              triggerVariant="ghost"
              submitLabel={common("approve")}
            />
            <FormDialog
              title={t("rejectLoan")}
              description={loan.loanNo}
              triggerLabel={common("reject")}
              successMessage={t("rejectedMsg")}
              fields={[
                {
                  name: "reason",
                  label: common("reason"),
                  type: "textarea",
                  colSpan: 2,
                },
              ]}
              initial={{ reason: "" }}
              action={reviewLoanAction.bind(
                null,
                locale,
                loan.id,
                "REJECTED",
              )}
              errorMessages={errorMessages}
              triggerSize="xs"
              triggerVariant="ghost"
              submitLabel={common("reject")}
            />
          </>
        )}
        {loan.approvedBy && (
          <Badge variant="outline" className="text-[10px]">
            {localizedName(
              locale,
              loan.approvedBy.name,
              loan.approvedBy.nameAr ?? loan.approvedBy.name,
            )}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canRequest ? (
            <FormDialog
              title={t("requestLoan")}
              description={t("subtitle")}
              triggerLabel={t("requestLoan")}
              triggerIcon="plus"
              successMessage={t("requestedMsg")}
              fields={requestFields()}
              initial={requestInitial()}
              action={requestLoanAction.bind(null, locale)}
              errorMessages={errorMessages}
              wide
            />
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("pendingRequests")}
          value={formatNumber(pendingTotal, locale)}
          hint={t("pending")}
          icon={<CalendarClock className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("activeLoans")}
          value={formatNumber(activeTotal, locale)}
          hint={nav("loans")}
          icon={<HandCoins className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("totalOutstanding")}
          value={formatMoney(Number(outstanding._sum.balance ?? 0), locale, "YER")}
          hint={t("balance")}
          icon={<Wallet className="size-5" />}
          tone="danger"
        />
        <StatCard
          label={t("upcomingInstallments")}
          value={formatNumber(pendingInstallments, locale)}
          hint={t("installmentSchedule")}
          icon={<CheckCircle2 className="size-5" />}
          tone="positive"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loans.length === 0 ? (
            <div className="p-6">
              <EmptyState title={t("noLoans")} />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("loanNo")}</TableHead>
                      {canApprove && <TableHead>{t("employee")}</TableHead>}
                      <TableHead>{t("amount")}</TableHead>
                      <TableHead>{t("installmentAmount")}</TableHead>
                      <TableHead>{t("balance")}</TableHead>
                      <TableHead>{t("startDate")}</TableHead>
                      <TableHead>{common("status")}</TableHead>
                      {canApprove && (
                        <TableHead className="text-end">
                          {common("actions")}
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell className="font-mono text-xs">
                          {loan.loanNo}
                        </TableCell>
                        {canApprove && (
                          <TableCell className="text-sm">
                            <Link
                              href={`/employees/${loan.employeeId}`}
                              className="hover:underline"
                            >
                              {localizedName(
                                locale,
                                `${loan.employee.firstName} ${loan.employee.lastName}`,
                                `${loan.employee.firstNameAr ?? ""} ${loan.employee.lastNameAr ?? ""}`.trim(),
                              )}
                            </Link>
                          </TableCell>
                        )}
                        <TableCell className="text-sm">
                          {formatMoney(loan.amount, locale, "YER")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatMoney(loan.installmentAmount, locale, "YER")} ×{" "}
                          {loan.installments}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatMoney(loan.balance, locale, "YER")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(loan.startDate, locale)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge value={loan.status} group="loanStatus" />
                        </TableCell>
                        {canApprove && (
                          <TableCell>
                            <LoanActions loan={loan} />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y md:hidden">
                {loans.map((loan) => (
                  <div key={loan.id} className="space-y-2.5 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        {canApprove && (
                          <Link
                            href={`/employees/${loan.employeeId}`}
                            className="block truncate text-sm font-semibold hover:underline"
                          >
                            {localizedName(
                              locale,
                              `${loan.employee.firstName} ${loan.employee.lastName}`,
                              `${loan.employee.firstNameAr ?? ""} ${loan.employee.lastNameAr ?? ""}`.trim(),
                            )}
                          </Link>
                        )}
                        <p className="font-mono text-xs text-muted-foreground">
                          {loan.loanNo}
                        </p>
                      </div>
                      <StatusBadge value={loan.status} group="loanStatus" />
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <span className="text-muted-foreground">
                        {t("amount")}:{" "}
                        <span className="text-foreground">
                          {formatMoney(loan.amount, locale, "YER")}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {t("balance")}:{" "}
                        <span className="text-foreground">
                          {formatMoney(loan.balance, locale, "YER")}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {t("installmentAmount")}:{" "}
                        <span className="text-foreground">
                          {formatMoney(loan.installmentAmount, locale, "YER")} ×{" "}
                          {loan.installments}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {t("startDate")}:{" "}
                        <span className="text-foreground">
                          {formatDate(loan.startDate, locale)}
                        </span>
                      </span>
                    </div>
                    <LoanActions loan={loan} />
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {common("showing")}{" "}
                  {formatNumber((safePage - 1) * PAGE_SIZE + 1, locale)}–
                  {formatNumber(Math.min(safePage * PAGE_SIZE, total), locale)}{" "}
                  {common("of")} {formatNumber(total, locale)}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    asChild={safePage > 1}
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                  >
                    {safePage > 1 ? (
                      <Link href={pageHref(safePage - 1)}>
                        <ChevronLeft className="size-4" /> {common("previous")}
                      </Link>
                    ) : (
                      <span>
                        <ChevronLeft className="size-4" /> {common("previous")}
                      </span>
                    )}
                  </Button>
                  <Badge variant="outline">
                    {formatNumber(safePage, locale)} /{" "}
                    {formatNumber(totalPages, locale)}
                  </Badge>
                  <Button
                    asChild={safePage < totalPages}
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                  >
                    {safePage < totalPages ? (
                      <Link href={pageHref(safePage + 1)}>
                        {common("next")} <ChevronRight className="size-4" />
                      </Link>
                    ) : (
                      <span>
                        {common("next")} <ChevronRight className="size-4" />
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("upcomingInstallments")}</CardTitle>
          <CardDescription>{t("installmentSchedule")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {upcoming.length === 0 ? (
            <div className="p-6">
              <EmptyState title={t("noInstallments")} />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("loanNo")}</TableHead>
                      {canApprove && <TableHead>{t("employee")}</TableHead>}
                      <TableHead>{t("dueDate")}</TableHead>
                      <TableHead>{t("amount")}</TableHead>
                      <TableHead>{common("status")}</TableHead>
                      {canApprove && (
                        <TableHead className="text-end">
                          {common("actions")}
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcoming.map((installment) => (
                      <TableRow key={installment.id}>
                        <TableCell className="font-mono text-xs">
                          {installment.loan.loanNo}
                        </TableCell>
                        {canApprove && (
                          <TableCell className="text-sm">
                            {localizedName(
                              locale,
                              `${installment.loan.employee.firstName} ${installment.loan.employee.lastName}`,
                              `${installment.loan.employee.firstNameAr ?? ""} ${installment.loan.employee.lastNameAr ?? ""}`.trim(),
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(installment.dueDate, locale)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatMoney(installment.amount, locale, "YER")}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            value={installment.status}
                            group="installmentStatus"
                          />
                        </TableCell>
                        {canApprove && (
                          <TableCell>
                            <FormDialog
                              title={t("markPaid")}
                              description={`${installment.loan.loanNo} · ${formatDate(
                                installment.dueDate,
                                locale,
                              )}`}
                              triggerLabel={t("markPaid")}
                              successMessage={t("installmentPaid")}
                              fields={[]}
                              initial={{}}
                              action={payInstallmentAction.bind(
                                null,
                                locale,
                                installment.id,
                              )}
                              errorMessages={errorMessages}
                              triggerSize="xs"
                              triggerVariant="ghost"
                              submitLabel={common("confirm")}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y md:hidden">
                {upcoming.map((installment) => (
                  <div key={installment.id} className="space-y-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {installment.loan.loanNo}
                      </span>
                      <StatusBadge
                        value={installment.status}
                        group="installmentStatus"
                      />
                    </div>
                    {canApprove && (
                      <p className="truncate text-sm font-medium">
                        {localizedName(
                          locale,
                          `${installment.loan.employee.firstName} ${installment.loan.employee.lastName}`,
                          `${installment.loan.employee.firstNameAr ?? ""} ${installment.loan.employee.lastNameAr ?? ""}`.trim(),
                        )}
                      </p>
                    )}
                    <div className="flex flex-wrap justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {t("dueDate")}: {formatDate(installment.dueDate, locale)}
                      </span>
                      <span className="font-medium">
                        {formatMoney(installment.amount, locale, "YER")}
                      </span>
                    </div>
                    {canApprove && (
                      <FormDialog
                        title={t("markPaid")}
                        description={`${installment.loan.loanNo} · ${formatDate(
                          installment.dueDate,
                          locale,
                        )}`}
                        triggerLabel={t("markPaid")}
                        successMessage={t("installmentPaid")}
                        fields={[]}
                        initial={{}}
                        action={payInstallmentAction.bind(
                          null,
                          locale,
                          installment.id,
                        )}
                        errorMessages={errorMessages}
                        triggerSize="xs"
                        triggerVariant="outline"
                        submitLabel={common("confirm")}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
