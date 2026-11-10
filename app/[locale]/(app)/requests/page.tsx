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
import { reviewRequestFormAction } from "./actions";
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
  const search = query.q?.trim();

  const requests = await prisma.employeeRequest.findMany({
    where: {
      ...(canViewAll
        ? {}
        : { employeeId: { in: employeeIds.length ? employeeIds : ["__none__"] } }),
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.type ? { type: query.type as never } : {}),
      ...(search
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
        : {}),
    },
    select: {
      id: true,
      employeeId: true,
      requestNo: true,
      type: true,
      subject: true,
      status: true,
      amount: true,
      createdAt: true,
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
  });

  const pending = requests.filter((request) => request.status === "PENDING").length;
  const approved = requests.filter((request) => request.status === "APPROVED").length;
  const rejected = requests.filter((request) => request.status === "REJECTED").length;

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
    if (canViewAll) return true;
    return step.approverId === user.id;
  }

  const typeOptions = [
    "SALARY_CERTIFICATE",
    "EMPLOYMENT_CERTIFICATE",
    "ADVANCE",
    "LOAN",
    "EXPENSE",
    "DOCUMENT",
    "OTHER",
  ];

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
          value={formatNumber(requests.length, locale)}
          hint={nav("requests")}
          icon={<ClipboardList className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("pendingMyApproval")}
          value={formatNumber(pending, locale)}
          hint={t("currentStep")}
          icon={<Clock3 className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("approvedMsg")}
          value={formatNumber(approved, locale)}
          hint={t("approvalHistory")}
          icon={<Check className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("rejectedMsg")}
          value={formatNumber(rejected, locale)}
          hint={t("status")}
          icon={<X className="size-5" />}
          tone="danger"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{canViewAll ? t("allRequests") : t("myRequests")}</CardTitle>
              <CardDescription>{t("workflow")}</CardDescription>
            </div>
            <form className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <LiveSearch
                className="w-full sm:w-48"
                initialValue={search}
                placeholder={t("searchPlaceholder")}
                ariaLabel={t("searchPlaceholder")}
              />
              <select
                name="type"
                defaultValue={query.type ?? ""}
                className="h-8 rounded-md border bg-background px-2 text-xs"
                aria-label={t("type")}
              >
                <option value="">{common("all")}</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type.toLowerCase().replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <select
                name="status"
                defaultValue={query.status ?? ""}
                className="h-8 rounded-md border bg-background px-2 text-xs"
                aria-label={t("status")}
              >
                <option value="">{common("all")}</option>
                {["PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((status) => (
                  <option key={status} value={status}>
                    {status.toLowerCase()}
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
                          <StatusBadge value={request.status} group="requestStatus" />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {canReview(request) ? (
                              <>
                                <form
                                  action={reviewRequestFormAction.bind(
                                    null,
                                    locale,
                                    request.id,
                                    "APPROVED",
                                  )}
                                >
                                  <Button size="sm" type="submit">
                                    <Check className="size-3.5" />
                                    <span className="sr-only sm:not-sr-only">
                                      {t("approve")}
                                    </span>
                                  </Button>
                                </form>
                                <form
                                  action={reviewRequestFormAction.bind(
                                    null,
                                    locale,
                                    request.id,
                                    "REJECTED",
                                  )}
                                >
                                  <Button size="sm" variant="outline" type="submit">
                                    <X className="size-3.5" />
                                    <span className="sr-only sm:not-sr-only">
                                      {t("reject")}
                                    </span>
                                  </Button>
                                </form>
                              </>
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
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
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
