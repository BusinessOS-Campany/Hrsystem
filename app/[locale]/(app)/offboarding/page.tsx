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
import { createOffboardingAction, toggleOffboardingTaskAction } from "./actions";
import { formatDate, formatNumber, localizedName } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, LogOut, Users } from "lucide-react";

export default async function OffboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requirePermission("offboarding.view", locale);
  const t = await getTranslations({ locale, namespace: "offboarding" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const enums = await getTranslations({ locale, namespace: "enums" });
  const canManage = hasPermission(user, "offboarding.manage");

  const [cases, eligibleEmployees] = await Promise.all([
    prisma.offboarding.findMany({
    include: {
      employee: {
        include: {
          employments: {
            where: { isCurrent: true },
            include: { department: true, position: true },
            take: 1,
          },
        },
      },
      tasks: { orderBy: [{ dueDate: "asc" }] },
    },
    orderBy: [{ status: "asc" }, { lastWorkingDate: "desc" }],
    }),
    canManage
      ? prisma.employee.findMany({
          where: {
            deletedAt: null,
            status: { notIn: ["TERMINATED", "RESIGNED", "RETIRED"] },
            offboardings: {
              none: { status: { in: ["NOT_STARTED", "IN_PROGRESS"] } },
            },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            firstNameAr: true,
            lastNameAr: true,
          },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const employeeOptions = eligibleEmployees.map((employee) => ({
    value: employee.id,
    label: localizedName(
      locale,
      `${employee.firstName} ${employee.lastName}`,
      `${employee.firstNameAr ?? ""} ${employee.lastNameAr ?? ""}`.trim(),
    ),
  }));
  const typeOptions = ["RESIGNATION", "TERMINATION", "RETIREMENT", "CONTRACT_EXPIRY"].map(
    (value) => ({ value, label: enums(`offboardingType.${value}` as never) }),
  );
  const categoryKeys: Record<string, string> = {
    ASSETS: "assetReturn",
    ASSET_RETURN: "assetReturn",
    EXIT: "exitInterview",
    EXIT_INTERVIEW: "exitInterview",
    ACCESS: "accountDeactivation",
    ACCOUNT_DEACTIVATION: "accountDeactivation",
    PAYROLL: "finalPayroll",
    FINAL_PAYROLL: "finalPayroll",
    LOANS: "loanClearance",
    LOAN_CLEARANCE: "loanClearance",
    DOCUMENTS: "documents",
    KNOWLEDGE: "knowledgeTransfer",
    KNOWLEDGE_TRANSFER: "knowledgeTransfer",
    CLEARANCE: "clearance",
    FINAL_CLEARANCE: "clearance",
  };
  const categoryLabel = (category: string) =>
    categoryKeys[category] ? t(categoryKeys[category] as never) : category;
  const errorMessages = {
    activeCaseExists: t("activeCaseExists"),
    notFound: t("notFound"),
    invalidDate: t("invalidDate"),
    unauthorized: t("unauthorized"),
    validation: t("requiredField"),
  };
  const createFields: FormField[] = [
    {
      name: "employeeId",
      label: t("employee"),
      type: "select",
      options: employeeOptions,
      required: true,
      placeholder: t("noEligibleEmployees"),
      colSpan: 2,
    },
    {
      name: "type",
      label: t("type"),
      type: "select",
      options: typeOptions,
      required: true,
    },
    { name: "requestDate", label: t("requestDate"), type: "date", required: true },
    {
      name: "lastWorkingDate",
      label: t("lastWorkingDay"),
      type: "date",
      required: true,
    },
    {
      name: "reason",
      label: t("reason"),
      type: "textarea",
      colSpan: 2,
    },
  ];
  const today = new Date().toISOString().slice(0, 10);
  const createInitial: Record<string, FormValue> = {
    employeeId: "",
    type: "RESIGNATION",
    requestDate: today,
    lastWorkingDate: "",
    reason: "",
  };

  const active = cases.filter((item) => item.status !== "COMPLETED");
  const completed = cases.filter((item) => item.status === "COMPLETED");
  const pendingTasks = cases.reduce(
    (sum, item) => sum + item.tasks.filter((task) => !task.completedAt).length,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canManage && employeeOptions.length > 0 ? (
            <FormDialog
              title={t("startOffboarding")}
              description={t("subtitle")}
              triggerLabel={t("startOffboarding")}
              triggerIcon="plus"
              successMessage={t("caseCreated")}
              fields={createFields}
              initial={createInitial}
              action={createOffboardingAction.bind(null, locale)}
              errorMessages={errorMessages}
              wide
            />
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("activeCases")}
          value={formatNumber(active.length, locale)}
          hint={t("checklist")}
          icon={<LogOut className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("completedCases")}
          value={formatNumber(completed.length, locale)}
          hint={t("offboardingCompleted")}
          icon={<CheckCircle2 className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("noTasks")}
          value={formatNumber(pendingTasks, locale)}
          hint={t("taskCompleted")}
          icon={<Circle className="size-5" />}
        />
        <StatCard
          label={t("employee")}
          value={formatNumber(cases.length, locale)}
          hint={nav("offboarding")}
          icon={<Users className="size-5" />}
          tone="info"
        />
      </div>

      {cases.length === 0 ? (
        <EmptyState title={t("noOffboardings")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cases.map((item) => {
            const employment = item.employee.employments[0];
            return (
              <Card key={item.id}>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="truncate">
                      <Link href={`/employees/${item.employeeId}`} className="hover:underline">
                        {localizedName(
                          locale,
                          `${item.employee.firstName} ${item.employee.lastName}`,
                          `${item.employee.firstNameAr ?? ""} ${item.employee.lastNameAr ?? ""}`.trim(),
                        )}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {employment
                        ? localizedName(
                            locale,
                            employment.position.name,
                            employment.position.nameAr,
                          )
                        : ""}{" "}
                      · {t("lastWorkingDay")}: {formatDate(item.lastWorkingDate, locale)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge value={item.status} group="lifecycleStatus" />
                    <StatusBadge value={item.type} group="offboardingType" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t("progress")}</span>
                      <span className="font-medium">{item.progress}%</span>
                    </div>
                    <Progress value={item.progress} className="h-1.5" />
                  </div>
                  <div className="space-y-1">
                    {item.tasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("noTasks")}</p>
                    ) : (
                      item.tasks.slice(0, 8).map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 rounded-md border p-2 text-sm"
                        >
                          {canManage ? (
                            <form action={toggleOffboardingTaskAction.bind(null, locale, task.id)}>
                              <button
                                type="submit"
                                className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-primary"
                                aria-label={t("taskCompleted")}
                              >
                                {task.completedAt ? (
                                  <CheckCircle2 className="size-4 text-emerald-600" />
                                ) : (
                                  <Circle className="size-4" />
                                )}
                              </button>
                            </form>
                          ) : task.completedAt ? (
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          ) : (
                            <Circle className="size-4 text-muted-foreground" />
                          )}
                          <span
                            className={
                              task.completedAt
                                ? "flex-1 truncate text-muted-foreground line-through"
                                : "flex-1 truncate"
                            }
                          >
                            {task.title}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {categoryLabel(task.category)}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                  {item.reason && (
                    <p className="text-xs text-muted-foreground">
                      {t("reason")}: {item.reason}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {t("requestDate")}: {formatDate(item.requestDate, locale)}
                    </span>
                    <span>
                      {item.tasks.filter((task) => task.completedAt).length}/{item.tasks.length}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
