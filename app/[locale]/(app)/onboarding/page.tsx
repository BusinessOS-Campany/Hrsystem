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
import { createOnboardingAction, toggleOnboardingTaskAction } from "./actions";
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
import { CheckCircle2, Circle, ClipboardList, UserCheck, Users } from "lucide-react";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requirePermission("onboarding.view", locale);
  const t = await getTranslations({ locale, namespace: "onboarding" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const canManage = hasPermission(user, "onboarding.manage");

  const [onboardings, eligibleEmployees] = await Promise.all([
    prisma.onboarding.findMany({
    select: {
      id: true,
      employeeId: true,
      status: true,
      progress: true,
      startDate: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
          firstNameAr: true,
          lastNameAr: true,
          employments: {
            where: { isCurrent: true },
            select: {
              position: { select: { name: true, nameAr: true } },
            },
            take: 1,
          },
        },
      },
      tasks: {
        select: {
          id: true,
          title: true,
          titleAr: true,
          category: true,
          completedAt: true,
          dueDate: true,
        },
        orderBy: [{ sortOrder: "asc" }],
      },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    }),
    canManage
      ? prisma.employee.findMany({
          where: {
            deletedAt: null,
            status: { in: ["ACTIVE", "PROBATION"] },
            onboarding: { is: null },
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
  const categoryKeys: Record<string, string> = {
    CONTRACT: "contract",
    DOCUMENTS: "documents",
    ACCOUNT: "account",
    EQUIPMENT: "equipment",
    ORIENTATION: "orientation",
    TRAINING: "training",
    MANAGER: "managerAssignment",
    PAYROLL: "payroll",
    CHECK_IN: "checkIn",
  };
  const categoryLabel = (category: string) =>
    categoryKeys[category] ? t(categoryKeys[category] as never) : category;
  const errorMessages = {
    duplicate: t("duplicatePlan"),
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
    { name: "startDate", label: t("startDate"), type: "date", required: true },
    { name: "templateName", label: t("template") },
  ];
  const createInitial: Record<string, FormValue> = {
    employeeId: "",
    startDate: new Date().toISOString().slice(0, 10),
    templateName: "STANDARD",
  };

  const active = onboardings.filter((plan) => plan.status !== "COMPLETED");
  const completed = onboardings.filter((plan) => plan.status === "COMPLETED");
  const pendingTasks = onboardings.reduce(
    (sum, plan) => sum + plan.tasks.filter((task) => !task.completedAt).length,
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
              title={t("createPlan")}
              description={t("subtitle")}
              triggerLabel={t("createPlan")}
              triggerIcon="plus"
              successMessage={t("planCreated")}
              fields={createFields}
              initial={createInitial}
              action={createOnboardingAction.bind(null, locale)}
              errorMessages={errorMessages}
              wide
            />
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("activePlans")}
          value={formatNumber(active.length, locale)}
          hint={t("checklist")}
          icon={<ClipboardList className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("completedPlans")}
          value={formatNumber(completed.length, locale)}
          hint={t("completed")}
          icon={<UserCheck className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("pending")}
          value={formatNumber(pendingTasks, locale)}
          hint={t("tasks")}
          icon={<Circle className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("employee")}
          value={formatNumber(onboardings.length, locale)}
          hint={nav("onboarding")}
          icon={<Users className="size-5" />}
        />
      </div>

      {onboardings.length === 0 ? (
        <EmptyState title={t("noOnboardings")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {onboardings.map((plan) => {
            const employment = plan.employee.employments[0];
            return (
              <Card key={plan.id}>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="truncate">
                      <Link href={`/employees/${plan.employeeId}`} className="hover:underline">
                        {localizedName(
                          locale,
                          `${plan.employee.firstName} ${plan.employee.lastName}`,
                          `${plan.employee.firstNameAr ?? ""} ${plan.employee.lastNameAr ?? ""}`.trim(),
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
                      · {t("startDate")}: {formatDate(plan.startDate, locale)}
                    </CardDescription>
                  </div>
                  <StatusBadge value={plan.status} group="lifecycleStatus" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t("overallProgress")}</span>
                      <span className="font-medium">{plan.progress}%</span>
                    </div>
                    <Progress value={plan.progress} className="h-1.5" />
                  </div>

                  <div className="space-y-1">
                    {plan.tasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("noTasks")}</p>
                    ) : (
                      plan.tasks.slice(0, 8).map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 rounded-md border p-2 text-sm"
                        >
                          {canManage ? (
                            <form action={toggleOnboardingTaskAction.bind(null, locale, task.id)}>
                              <button
                                type="submit"
                                className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-primary"
                                aria-label={t("markComplete")}
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
                            {locale === "ar" && task.titleAr ? task.titleAr : task.title}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {categoryLabel(task.category)}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {t("tasks")}: {plan.tasks.filter((task) => task.completedAt).length}/
                      {plan.tasks.length}
                    </span>
                    <span>
                      {t("dueDate")}:{" "}
                      {formatDate(
                        plan.tasks.find((task) => task.dueDate && !task.completedAt)?.dueDate,
                        locale,
                      )}
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
