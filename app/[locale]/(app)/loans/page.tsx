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
import { CalendarClock, CheckCircle2, HandCoins, Wallet } from "lucide-react";
import {
  payInstallmentAction,
  requestLoanAction,
  reviewLoanAction,
} from "./actions";

export default async function LoansPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requirePermission("loan.view", locale);
  const t = await getTranslations({ locale, namespace: "loans" });
  const common = await getTranslations({ locale, namespace: "common" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const canApprove = hasPermission(user, "loan.approve");
  const canRequest = hasPermission(user, "loan.request") && Boolean(user.employeeId);

  const loans = await prisma.employeeLoan.findMany({
    where: canApprove ? {} : { employeeId: user.employeeId ?? "__none__" },
    include: {
      employee: true,
      approvedBy: true,
      installmentsList: { orderBy: { dueDate: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const pendingLoans = loans.filter((loan) => loan.status === "PENDING");
  const activeLoans = loans.filter((loan) => loan.status === "ACTIVE");
  const outstanding = activeLoans.reduce((sum, loan) => sum + Number(loan.balance), 0);
  const pendingInstallments = activeLoans
    .flatMap((loan) =>
      loan.installmentsList
        .filter((installment) => installment.status === "PENDING")
        .map((installment) => ({ ...installment, loan })),
    )
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const upcomingInstallments = pendingInstallments.slice(0, 24);

  const errorMessages = {
    noEmployee: t("noEmployee"),
    invalidDate: t("invalidDate"),
    pendingExists: t("pendingExists"),
    notPending: t("notPending"),
    notActive: t("notActive"),
    alreadyPaid: t("alreadyPaid"),
    selfApproval: t("selfApproval"),
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
        min: "0",
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
      startDate: "",
      reason: "",
    };
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
          value={formatNumber(pendingLoans.length, locale)}
          hint={t("pending")}
          icon={<CalendarClock className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("activeLoans")}
          value={formatNumber(activeLoans.length, locale)}
          hint={nav("loans")}
          icon={<HandCoins className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("totalOutstanding")}
          value={formatMoney(outstanding, locale, "YER")}
          hint={t("balance")}
          icon={<Wallet className="size-5" />}
          tone="danger"
        />
        <StatCard
          label={t("upcomingInstallments")}
          value={formatNumber(pendingInstallments.length, locale)}
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
                  {canApprove && <TableHead>{common("actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-mono text-xs">{loan.loanNo}</TableCell>
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
                                loan.approvedBy.nameAr,
                              )}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("upcomingInstallments")}</CardTitle>
          <CardDescription>{t("installmentSchedule")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {upcomingInstallments.length === 0 ? (
            <div className="p-6">
              <EmptyState title={t("noInstallments")} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("loanNo")}</TableHead>
                  {canApprove && <TableHead>{t("employee")}</TableHead>}
                  <TableHead>{t("dueDate")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead>{common("status")}</TableHead>
                  {canApprove && <TableHead>{common("actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingInstallments.map((installment) => (
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
                          action={payInstallmentAction.bind(null, locale, installment.id)}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
