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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Award, CalendarRange, Target, Users } from "lucide-react";
import {
  createCycleAction,
  createGoalAction,
  submitManagerReviewAction,
  submitSelfReviewAction,
  updateGoalProgressAction,
} from "./actions";

export default async function PerformancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requirePermission("performance.view", locale);
  const t = await getTranslations({ locale, namespace: "performance" });
  const common = await getTranslations({ locale, namespace: "common" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const enums = await getTranslations({ locale, namespace: "enums" });

  const canViewAll = hasPermission(user, "performance.view_all");
  const canReviewTeam = hasPermission(user, "performance.review_team");
  const canManage = hasPermission(user, "performance.manage");
  const canSelf = hasPermission(user, "performance.review_self");

  const [cycles, reviews, goals, employees] = await Promise.all([
    prisma.performanceCycle.findMany({
      include: { _count: { select: { reviews: true } } },
      orderBy: { startDate: "desc" },
    }),
    prisma.performanceReview.findMany({
      where: canViewAll
        ? {}
        : canReviewTeam && user.employeeId
          ? { OR: [{ employeeId: user.employeeId }, { managerId: user.employeeId }] }
          : { employeeId: user.employeeId ?? "__none__" },
      include: {
        employee: true,
        manager: true,
        cycle: true,
        _count: { select: { goals: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.goal.findMany({
      where: canViewAll
        ? {}
        : canReviewTeam && user.employeeId
          ? { OR: [{ employeeId: user.employeeId }, { employee: { managerId: user.employeeId } }] }
          : { employeeId: user.employeeId ?? "__none__" },
      include: { employee: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 40,
    }),
    prisma.employee.findMany({
      where: { deletedAt: null, status: { in: ["ACTIVE", "PROBATION"] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        firstNameAr: true,
        lastNameAr: true,
        managerId: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const completedReviews = reviews.filter((review) => review.status === "COMPLETED");
  const averageRating =
    completedReviews.length > 0
      ? completedReviews.reduce((sum, review) => sum + Number(review.finalRating ?? 0), 0) /
        completedReviews.length
      : 0;
  const activeGoals = goals.filter((goal) => goal.status !== "ACHIEVED");
  const averageProgress =
    goals.length > 0
      ? Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length)
      : 0;

  const employeeOptions = employees.map((employee) => ({
    value: employee.id,
    label: localizedName(
      locale,
      `${employee.firstName} ${employee.lastName}`,
      `${employee.firstNameAr ?? ""} ${employee.lastNameAr ?? ""}`.trim(),
    ),
  }));
  const cycleOptions = cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }));
  const lifecycleOptions = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map(
    (value) => ({ value, label: enums(`lifecycleStatus.${value}` as never) }),
  );
  const goalStatusOptions = ["NOT_STARTED", "IN_PROGRESS", "ACHIEVED", "MISSED", "CANCELLED"].map(
    (value) => ({ value, label: enums(`goalStatus.${value}` as never) }),
  );
  const ratingOptions = [1, 2, 3, 4, 5].map((value) => ({
    value: String(value),
    label: `${value} — ${t(`rating${value}` as never)}`,
  }));
  const errorMessages = {
    forbidden: t("notAllowed"),
    completed: t("alreadyCompleted"),
    invalidDate: common("error"),
    notFound: common("noResults"),
    unauthorized: common("error"),
    validation: common("requiredField"),
  };

  function cycleFields(): FormField[] {
    return [
      { name: "name", label: common("name"), required: true, colSpan: 2 },
      {
        name: "description",
        label: common("description"),
        type: "textarea",
        colSpan: 2,
      },
      { name: "startDate", label: t("startDate"), type: "date", required: true },
      { name: "endDate", label: t("endDate"), type: "date", required: true },
      {
        name: "status",
        label: common("status"),
        type: "select",
        options: lifecycleOptions,
      },
      {
        name: "generateReviews",
        label: t("generateReviews"),
        type: "switch",
        help: t("generateReviewsHelp"),
      },
    ];
  }

  function cycleInitial(): Record<string, FormValue> {
    return {
      name: "",
      description: "",
      startDate: "",
      endDate: "",
      status: "NOT_STARTED",
      generateReviews: true,
    };
  }

  function goalFields(): FormField[] {
    return [
      ...(canManage
        ? [
            {
              name: "employeeId",
              label: t("employee"),
              type: "select" as const,
              options: employeeOptions,
              required: true,
              placeholder: common("none"),
            },
          ]
        : []),
      {
        name: "cycleId",
        label: t("cycle"),
        type: "select",
        options: cycleOptions,
        placeholder: common("none"),
      },
      { name: "title", label: t("goalTitle"), required: true, colSpan: 2 },
      {
        name: "description",
        label: common("description"),
        type: "textarea",
        colSpan: 2,
      },
      {
        name: "weight",
        label: t("weight"),
        type: "number",
        min: "0",
        max: "100",
        step: "1",
        required: true,
      },
      { name: "target", label: t("target") },
      { name: "dueDate", label: t("dueDate"), type: "date" },
      {
        name: "progress",
        label: t("progress"),
        type: "number",
        min: "0",
        max: "100",
        step: "1",
      },
      {
        name: "status",
        label: common("status"),
        type: "select",
        options: goalStatusOptions,
      },
    ];
  }

  function goalInitial(): Record<string, FormValue> {
    return {
      employeeId: canManage ? employees[0]?.id ?? "" : user.employeeId ?? "",
      cycleId: cycles[0]?.id ?? "",
      title: "",
      description: "",
      weight: "10",
      target: "",
      dueDate: "",
      progress: "0",
      status: "NOT_STARTED",
    };
  }

  function selfReviewFields(): FormField[] {
    return [
      {
        name: "selfRating",
        label: t("selfRating"),
        type: "select",
        options: ratingOptions,
        required: true,
      },
      {
        name: "selfComment",
        label: t("selfComment"),
        type: "textarea",
        colSpan: 2,
      },
    ];
  }

  function managerReviewFields(): FormField[] {
    return [
      {
        name: "managerRating",
        label: t("managerRating"),
        type: "select",
        options: ratingOptions,
        required: true,
      },
      {
        name: "managerComment",
        label: t("managerComment"),
        type: "textarea",
        colSpan: 2,
      },
    ];
  }

  function goalProgressFields(): FormField[] {
    return [
      {
        name: "progress",
        label: t("progress"),
        type: "number",
        min: "0",
        max: "100",
        step: "1",
        required: true,
      },
      {
        name: "status",
        label: common("status"),
        type: "select",
        options: goalStatusOptions,
      },
    ];
  }

  function canUpdateGoal(goal: (typeof goals)[number]) {
    return (
      canManage ||
      (canSelf && goal.employeeId === user.employeeId) ||
      (canReviewTeam && goal.employee.managerId === user.employeeId)
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canManage || canSelf ? (
            <>
              {canManage && (
                <FormDialog
                  title={t("addCycle")}
                  description={t("subtitle")}
                  triggerLabel={t("addCycle")}
                  triggerIcon="plus"
                  successMessage={t("cycleCreated")}
                  fields={cycleFields()}
                  initial={cycleInitial()}
                  action={createCycleAction.bind(null, locale)}
                  errorMessages={errorMessages}
                  wide
                />
              )}
              <FormDialog
                title={t("addGoal")}
                description={t("subtitle")}
                triggerLabel={t("addGoal")}
                triggerIcon="plus"
                triggerVariant="outline"
                successMessage={t("goalCreated")}
                fields={goalFields()}
                initial={goalInitial()}
                action={createGoalAction.bind(null, locale)}
                errorMessages={errorMessages}
                wide
              />
            </>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("cycles")}
          value={formatNumber(cycles.length, locale)}
          hint={nav("performance")}
          icon={<CalendarRange className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("reviews")}
          value={formatNumber(reviews.length, locale)}
          hint={`${formatNumber(completedReviews.length, locale)} ${t("overall")}`}
          icon={<Users className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("finalRating")}
          value={averageRating > 0 ? `${averageRating.toFixed(1)}/5` : "—"}
          hint={t("ratings")}
          icon={<Award className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("goals")}
          value={formatNumber(activeGoals.length, locale)}
          hint={`${t("progress")}: ${averageProgress}%`}
          icon={<Target className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("cycles")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {cycles.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noCycles")}</p>
            ) : (
              cycles.map((cycle) => (
                <div key={cycle.id} className="rounded-md border p-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{cycle.name}</p>
                    <StatusBadge value={cycle.status} group="lifecycleStatus" />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(cycle.startDate, locale)} – {formatDate(cycle.endDate, locale)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {cycle._count.reviews} {t("reviews")}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("reviews")}</CardTitle>
            <CardDescription>{canViewAll ? t("reviews") : t("myReview")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {reviews.length === 0 ? (
              <div className="p-6">
                <EmptyState title={t("noReviews")} />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("employee")}</TableHead>
                    <TableHead>{t("cycle")}</TableHead>
                    <TableHead>{t("selfReview")}</TableHead>
                    <TableHead>{t("managerReview")}</TableHead>
                    <TableHead>{t("finalRating")}</TableHead>
                    <TableHead>{common("status")}</TableHead>
                    {(canSelf || canReviewTeam) && (
                      <TableHead>{common("actions")}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell>
                        <Link
                          href={`/employees/${review.employeeId}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {localizedName(
                            locale,
                            `${review.employee.firstName} ${review.employee.lastName}`,
                            `${review.employee.firstNameAr ?? ""} ${review.employee.lastNameAr ?? ""}`.trim(),
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {review.cycle.name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {review.selfRating ? `${review.selfRating}/5` : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {review.managerRating ? `${review.managerRating}/5` : "—"}
                      </TableCell>
                      <TableCell>
                        {review.finalRating ? (
                          <Badge variant="secondary">
                            {Number(review.finalRating).toFixed(1)}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={review.status} group="reviewStatus" />
                      </TableCell>
                      {(canSelf || canReviewTeam) && (
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            {canSelf &&
                              review.employeeId === user.employeeId &&
                              review.status !== "COMPLETED" && (
                                <FormDialog
                                  title={t("selfReview")}
                                  description={t("reviewFor", { name: review.cycle.name })}
                                  triggerLabel={t("selfReview")}
                                  successMessage={t("reviewSubmitted")}
                                  fields={selfReviewFields()}
                                  initial={{
                                    selfRating:
                                      review.selfRating != null
                                        ? String(review.selfRating)
                                        : "",
                                    selfComment: review.selfComment ?? "",
                                  }}
                                  action={submitSelfReviewAction.bind(
                                    null,
                                    locale,
                                    review.id,
                                  )}
                                  errorMessages={errorMessages}
                                  triggerSize="xs"
                                  triggerVariant="ghost"
                                />
                              )}
                            {canReviewTeam &&
                              (canViewAll || review.managerId === user.employeeId) &&
                              review.status !== "COMPLETED" && (
                                <FormDialog
                                  title={t("managerReview")}
                                  description={t("reviewFor", { name: review.cycle.name })}
                                  triggerLabel={t("managerReview")}
                                  triggerIcon="edit"
                                  successMessage={t("reviewSubmitted")}
                                  fields={managerReviewFields()}
                                  initial={{
                                    managerRating:
                                      review.managerRating != null
                                        ? String(review.managerRating)
                                        : "",
                                    managerComment: review.managerComment ?? "",
                                  }}
                                  action={submitManagerReviewAction.bind(
                                    null,
                                    locale,
                                    review.id,
                                  )}
                                  errorMessages={errorMessages}
                                  triggerSize="xs"
                                  triggerVariant="ghost"
                                />
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("goals")}</CardTitle>
          <CardDescription>{t("progress")}</CardDescription>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <EmptyState title={t("noGoals")} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {goals.map((goal) => (
                <div key={goal.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{goal.title}</p>
                    <StatusBadge value={goal.status} group="goalStatus" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {localizedName(
                      locale,
                      `${goal.employee.firstName} ${goal.employee.lastName}`,
                      `${goal.employee.firstNameAr ?? ""} ${goal.employee.lastNameAr ?? ""}`.trim(),
                    )}{" "}
                    · {t("weight")}: {goal.weight}%
                  </p>
                  <Progress value={goal.progress} className="h-1.5" />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{goal.progress}%</span>
                    <span>{formatDate(goal.dueDate, locale)}</span>
                  </div>
                  {canUpdateGoal(goal) && (
                    <div className="pt-1">
                      <FormDialog
                        title={t("updateProgress")}
                        description={goal.title}
                        triggerLabel={t("updateProgress")}
                        successMessage={t("goalUpdated")}
                        fields={goalProgressFields()}
                        initial={{
                          progress: String(goal.progress),
                          status: goal.status,
                        }}
                        action={updateGoalProgressAction.bind(null, locale, goal.id)}
                        errorMessages={errorMessages}
                        triggerSize="xs"
                        triggerVariant="ghost"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
