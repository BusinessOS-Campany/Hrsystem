import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LiveSearch } from "@/components/shared/live-search";
import { StatusBadge } from "@/components/shared/status-badge";
import { RequestForm } from "@/components/requests/request-form";
import { RequestReviewActions } from "@/components/requests/request-review-actions";
import { formatDate, formatMoney, formatNumber, localizedName } from "@/lib/format";
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
import { Check, ClipboardList, Clock3, Plus, X } from "lucide-react";

const TYPES = [
  "SALARY_CERTIFICATE",
  "EMPLOYMENT_CERTIFICATE",
  "ADVANCE",
  "LOAN",
  "EXPENSE",
  "DOCUMENT",
  "OTHER",
] as const;

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

export default async function RequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; type?: string; q?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const user = await requirePermission("request.view", locale);
  const t = await getTranslations({ locale, namespace: "requests" });
  const common = await getTranslations({ locale, namespace: "common" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const canViewAll = hasPermission(user, "request.view_all");
  const canApprove = hasPermission(user, "request.approve");
  const canCreate = hasPermission(user, "request.create");

  const reports = user.employeeId
    ? await prisma.employee.findMany({
        where: { managerId: user.employeeId, deletedAt: null },
        select: { id: true },
      })
    : [];
  const employeeIds = user.employeeId
    ? [user.employeeId, ...reports.map((report) => report.id)]
    : [];
  const search = query.q?.trim().slice(0, 100) || undefined;
  const statusFilter = STATUSES.includes(query.status as (typeof STATUSES)[number])
    ? (query.status as (typeof STATUSES)[number])
    : undefined;
  const typeFilter = TYPES.includes(query.type as (typeof TYPES)[number])
    ? (query.type as (typeof TYPES)[number])
    : undefined;

  const visibleFilter = canViewAll
    ? {}
    : { employeeId: { in: employeeIds.length ? employeeIds : ["__none__"] } };
  const searchFilter = search
    ? {
        OR: [
          { requestNo: { contains: search, mode: "insensitive" as const } },
          { subject: { contains: search, mode: "insensitive" as const } },
          { details: { contains: search, mode: "insensitive" as const } },
          {
            employee: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" as const } },
                { lastName: { contains: search, mode: "insensitive" as const } },
                { employeeNo: { contains: search, mode: "insensitive" as const } },
              ],
            },
          },
        ],
      }
    : {};

  const roleIds = user.roles.map((role) => role.id);
  const [requests, statusCounts, myPending] = await Promise.all([
    prisma.employeeRequest.findMany({
      where: {
        ...visibleFilter,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(typeFilter ? { type: typeFilter } : {}),
        ...searchFilter,
      },
      select: {
        id: true,
        employeeId: true,
        requestNo: true,
        type: true,
        subject: true,
        details: true,
        status: true,
        amount: true,
        createdAt: true,
        currentStep: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            firstNameAr: true,
            lastNameAr: true,
          },
        },
        approvalSteps: {
          select: {
            id: true,
            stepOrder: true,
            status: true,
            approverId: true,
            roleId: true,
          },
          orderBy: { stepOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.employeeRequest.groupBy({
      by: ["status"],
      where: visibleFilter,
      _count: { _all: true },
    }),
    canApprove
      ? prisma.approvalStep.count({
          where: {
            status: "PENDING",
            request: { status: "PENDING", ...visibleFilter },
            ...(canViewAll
              ? {}
              : {
                  OR: [
                    { approverId: user.id },
                    ...(roleIds.length ? [{ roleId: { in: roleIds } }] : []),
                  ],
                }),
          },
        })
      : Promise.resolve(0),
  ]);

  const countFor = (status: string) =>
    statusCounts.find((item) => item.status === status)?._count._all ?? 0;
  const totalCount = statusCounts.reduce(
    (sum, item) => sum + item._count._all,
    0,
  );

  function canReview(request: {
    approvalSteps: {
      status: string;
      approverId: string | null;
      roleId: string | null;
    }[];
  }) {
    if (!canApprove) return false;
    const step = request.approvalSteps.find((item) => item.status === "PENDING");
    if (!step) return false;
    if (step.approverId) return step.approverId === user.id;
    if (step.roleId) return roleIds.includes(step.roleId);
    return canViewAll;
  }

  function typeLabel(type: (typeof TYPES)[number]) {
    const keys = {
      SALARY_CERTIFICATE: "salaryCertificate",
      EMPLOYMENT_CERTIFICATE: "employmentCertificate",
      ADVANCE: "advance",
      LOAN: "loan",
      EXPENSE: "expense",
      DOCUMENT: "document",
      OTHER: "other",
    } as const;
    return t(keys[type]);
  }

  function statusLabel(status: string) {
    switch (status) {
      case "PENDING":
        return common("pending");
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canCreate ? (
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
          label={t("title")}
          value={formatNumber(totalCount, locale)}
          hint={nav("requests")}
          icon={<ClipboardList className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("pendingMyApproval")}
          value={formatNumber(myPending, locale)}
          hint={t("currentStep")}
          icon={<Clock3 className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("approvedMsg")}
          value={formatNumber(countFor("APPROVED"), locale)}
          hint={t("approvalHistory")}
          icon={<Check className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("rejectedMsg")}
          value={formatNumber(countFor("REJECTED"), locale)}
          hint={t("status")}
          icon={<X className="size-5" />}
          tone="danger"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="min-w-0 lg:col-span-3">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{canViewAll ? t("allRequests") : t("myRequests")}</CardTitle>
              <CardDescription>{t("workflow")}</CardDescription>
            </div>
            <form className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <LiveSearch
                className="w-full sm:w-48"
                initialValue={search}
                placeholder={t("searchPlaceholder")}
                ariaLabel={t("searchPlaceholder")}
              />
              <select
                name="type"
                defaultValue={typeFilter ?? ""}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm sm:h-8 sm:w-auto sm:text-xs"
                aria-label={t("type")}
              >
                <option value="">{common("allTypes")}</option>
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(type)}
                  </option>
                ))}
              </select>
              <select
                name="status"
                defaultValue={statusFilter ?? ""}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm sm:h-8 sm:w-auto sm:text-xs"
                aria-label={t("status")}
              >
                <option value="">{common("allStatuses")}</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" variant="outline">
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
                        <TableHead>{t("employee")}</TableHead>
                        <TableHead>{t("type")}</TableHead>
                        <TableHead>{t("subject")}</TableHead>
                        <TableHead>{t("currentStep")}</TableHead>
                        <TableHead>{t("status")}</TableHead>
                        <TableHead className="text-end">{common("actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request) => {
                        const pendingStep = request.approvalSteps.find(
                          (step) => step.status === "PENDING",
                        );
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
                                {localizedName(
                                  locale,
                                  `${request.employee.firstName} ${request.employee.lastName}`,
                                  `${request.employee.firstNameAr ?? ""} ${request.employee.lastNameAr ?? ""}`.trim(),
                                )}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <StatusBadge value={request.type} group="requestType" />
                            </TableCell>
                            <TableCell className="max-w-56">
                              <p className="truncate text-sm">{request.subject}</p>
                              {request.amount && (
                                <p className="text-xs text-muted-foreground">
                                  {formatMoney(request.amount, locale, "YER")}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {pendingStep
                                ? `${pendingStep.stepOrder} / ${request.approvalSteps.length}`
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                value={request.status}
                                group="requestStatus"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap justify-end gap-1">
                                {canReview(request) ? (
                                  <RequestReviewActions
                                    locale={locale}
                                    requestId={request.id}
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {formatDate(request.createdAt, locale)}
                                  </span>
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
                    const pendingStep = request.approvalSteps.find(
                      (step) => step.status === "PENDING",
                    );
                    return (
                      <div key={request.id} className="space-y-2.5 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/employees/${request.employeeId}`}
                              className="block truncate text-sm font-semibold hover:underline"
                            >
                              {localizedName(
                                locale,
                                `${request.employee.firstName} ${request.employee.lastName}`,
                                `${request.employee.firstNameAr ?? ""} ${request.employee.lastNameAr ?? ""}`.trim(),
                              )}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">
                              {request.requestNo} · {typeLabel(request.type)}
                            </p>
                          </div>
                          <StatusBadge
                            value={request.status}
                            group="requestStatus"
                          />
                        </div>
                        <p className="break-words text-sm font-medium">
                          {request.subject}
                        </p>
                        {request.details && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {request.details}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{formatDate(request.createdAt, locale)}</span>
                          {request.amount && (
                            <span>
                              {formatMoney(request.amount, locale, "YER")}
                            </span>
                          )}
                          {pendingStep && (
                            <span>
                              {t("step")} {pendingStep.stepOrder} /{" "}
                              {request.approvalSteps.length}
                            </span>
                          )}
                        </div>
                        {canReview(request) && (
                          <RequestReviewActions
                            locale={locale}
                            requestId={request.id}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          {canCreate && (
            <Card id="new-request">
              <CardHeader>
                <CardTitle>{t("newRequest")}</CardTitle>
                <CardDescription>{t("subtitle")}</CardDescription>
              </CardHeader>
              <CardContent>
                <RequestForm locale={locale} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t("approvalHistory")}</CardTitle>
              <CardDescription>{t("workflow")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {requests.slice(0, 5).map((request) => (
                <div key={request.id} className="rounded-md border p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{request.requestNo}</span>
                    <StatusBadge value={request.status} group="requestStatus" />
                  </div>
                  <p className="mt-1 truncate text-muted-foreground">{request.subject}</p>
                  <p className="text-muted-foreground">
                    {formatDate(request.createdAt, locale)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
