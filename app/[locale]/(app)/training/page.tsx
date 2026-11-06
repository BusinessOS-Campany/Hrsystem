import { getTranslations, setRequestLocale } from "next-intl/server";
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
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen, GraduationCap, UserCheck, Wallet } from "lucide-react";
import {
  createCourseAction,
  enrollEmployeeAction,
  updateCourseAction,
  updateEnrollmentAction,
} from "./actions";

export default async function TrainingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requirePermission("training.view", locale);
  const t = await getTranslations({ locale, namespace: "training" });
  const common = await getTranslations({ locale, namespace: "common" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const enums = await getTranslations({ locale, namespace: "enums" });
  const canManage = hasPermission(user, "training.manage");
  const canViewAll = hasPermission(user, "employee.view_all") || canManage;

  const [courses, employees] = await Promise.all([
    prisma.trainingCourse.findMany({
    include: {
      enrollments: {
        where: canViewAll ? {} : { employeeId: user.employeeId ?? "__none__" },
        include: { employee: true },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { enrollments: true } },
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.employee.findMany({
      where: { deletedAt: null, status: { in: ["ACTIVE", "PROBATION"] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        firstNameAr: true,
        lastNameAr: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const allEnrollments = courses.flatMap((course) => course.enrollments);
  const completed = allEnrollments.filter(
    (enrollment) => enrollment.status === "COMPLETED",
  ).length;
  const activeCourses = courses.filter((course) => course.status === "IN_PROGRESS").length;
  const totalCost = courses.reduce((sum, course) => sum + Number(course.cost ?? 0), 0);
  const completionRate =
    allEnrollments.length > 0 ? Math.round((completed / allEnrollments.length) * 100) : 0;

  const employeeOptions = employees.map((employee) => ({
    value: employee.id,
    label: localizedName(
      locale,
      `${employee.firstName} ${employee.lastName}`,
      `${employee.firstNameAr ?? ""} ${employee.lastNameAr ?? ""}`.trim(),
    ),
  }));
  const courseStatusOptions = ["PLANNED", "OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map(
    (value) => ({ value, label: enums(`courseStatus.${value}` as never) }),
  );
  const enrollmentStatusOptions = ["ENROLLED", "IN_PROGRESS", "COMPLETED", "FAILED", "WITHDRAWN"].map(
    (value) => ({ value, label: enums(`enrollmentStatus.${value}` as never) }),
  );
  const errorMessages = {
    duplicate: t("duplicateCourse"),
    full: t("full"),
    alreadyEnrolled: t("alreadyEnrolled"),
    invalidDate: t("invalidDates"),
    invalidScore: t("invalidScore"),
    notFound: common("noResults"),
    unauthorized: common("error"),
    validation: common("requiredField"),
  };

  function courseFields(): FormField[] {
    return [
      { name: "code", label: common("code"), required: true, dir: "ltr" },
      { name: "title", label: common("name"), required: true },
      { name: "titleAr", label: common("nameAr"), dir: "rtl" },
      {
        name: "description",
        label: common("description"),
        type: "textarea",
        colSpan: 2,
      },
      { name: "provider", label: t("provider") },
      { name: "trainer", label: t("trainer") },
      { name: "category", label: t("category") },
      { name: "startDate", label: t("startDate"), type: "date" },
      { name: "endDate", label: t("endDate"), type: "date" },
      { name: "cost", label: t("cost"), type: "number", min: "0", step: "0.01" },
      { name: "currency", label: common("currency"), dir: "ltr" },
      {
        name: "capacity",
        label: t("capacity"),
        type: "number",
        min: "0",
        step: "1",
      },
      {
        name: "status",
        label: common("status"),
        type: "select",
        options: courseStatusOptions,
      },
    ];
  }

  function courseInitial(course?: (typeof courses)[number]): Record<string, FormValue> {
    return {
      code: course?.code ?? "",
      title: course?.title ?? "",
      titleAr: course?.titleAr ?? "",
      description: course?.description ?? "",
      provider: course?.provider ?? "",
      trainer: course?.trainer ?? "",
      category: course?.category ?? "",
      startDate: course?.startDate ? course.startDate.toISOString().slice(0, 10) : "",
      endDate: course?.endDate ? course.endDate.toISOString().slice(0, 10) : "",
      cost: course?.cost != null ? String(course.cost) : "",
      currency: course?.currency ?? "YER",
      capacity: course?.capacity != null ? String(course.capacity) : "",
      status: course?.status ?? "PLANNED",
    };
  }

  function enrollmentFields(): FormField[] {
    return [
      {
        name: "employeeId",
        label: t("selectEmployee"),
        type: "select",
        options: employeeOptions,
        required: true,
        placeholder: common("none"),
        colSpan: 2,
      },
    ];
  }

  function enrollmentUpdateFields(): FormField[] {
    return [
      {
        name: "status",
        label: common("status"),
        type: "select",
        options: enrollmentStatusOptions,
      },
      {
        name: "score",
        label: t("score"),
        type: "number",
        min: "0",
        max: "100",
        step: "1",
      },
      {
        name: "certificateUrl",
        label: t("certificateUrl"),
        type: "url",
        dir: "ltr",
        colSpan: 2,
      },
      {
        name: "feedback",
        label: t("feedback"),
        type: "textarea",
        colSpan: 2,
      },
    ];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canManage ? (
            <FormDialog
              title={t("addCourse")}
              description={t("subtitle")}
              triggerLabel={t("addCourse")}
              triggerIcon="plus"
              successMessage={t("courseCreated")}
              fields={courseFields()}
              initial={courseInitial()}
              action={createCourseAction.bind(null, locale)}
              errorMessages={errorMessages}
              wide
            />
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("activeCourses")}
          value={formatNumber(activeCourses, locale)}
          hint={nav("training")}
          icon={<BookOpen className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("totalEnrollments")}
          value={formatNumber(allEnrollments.length, locale)}
          hint={t("enrollments")}
          icon={<GraduationCap className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("completionRate")}
          value={`${completionRate}%`}
          hint={`${formatNumber(completed, locale)} ${t("completed")}`}
          icon={<UserCheck className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("cost")}
          value={formatMoney(totalCost, locale, "YER")}
          hint={t("courses")}
          icon={<Wallet className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {courses.length === 0 ? (
            <EmptyState title={t("noCourses")} />
          ) : (
            courses.map((course) => {
              const courseCompleted = course.enrollments.filter(
                (enrollment) => enrollment.status === "COMPLETED",
              ).length;
              const rate =
                course._count.enrollments > 0
                  ? Math.round((courseCompleted / course._count.enrollments) * 100)
                  : 0;
              return (
                <Card key={course.id}>
                  <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="truncate">
                        {localizedName(locale, course.title, course.titleAr)}
                      </CardTitle>
                      <CardDescription>
                        {course.code} · {course.provider ?? "—"} ·{" "}
                        {course.category ?? t("category")}
                      </CardDescription>
                    </div>
                    <StatusBadge value={course.status} group="courseStatus" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {t("startDate")}: {formatDate(course.startDate, locale)}
                      </span>
                      <span>
                        {t("endDate")}: {formatDate(course.endDate, locale)}
                      </span>
                      <span>
                        {t("capacity")}: {course.capacity ?? "—"}
                      </span>
                      <span>
                        {t("cost")}: {formatMoney(course.cost, locale, course.currency)}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t("completionRate")}</span>
                        <span className="font-medium">{rate}%</span>
                      </div>
                      <Progress value={rate} className="h-1.5" />
                    </div>
                    {course.enrollments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {course.enrollments.slice(0, 8).map((enrollment) => (
                          <Badge key={enrollment.id} variant="secondary" className="text-[10px]">
                            {localizedName(
                              locale,
                              `${enrollment.employee.firstName} ${enrollment.employee.lastName}`,
                              `${enrollment.employee.firstNameAr ?? ""} ${enrollment.employee.lastNameAr ?? ""}`.trim(),
                            )}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {canManage && (
                      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                        <FormDialog
                          title={t("addEnrollment")}
                          description={localizedName(locale, course.title, course.titleAr)}
                          triggerLabel={t("enroll")}
                          triggerIcon="plus"
                          successMessage={t("enrolledMsg")}
                          fields={enrollmentFields()}
                          initial={{ employeeId: "" }}
                          action={enrollEmployeeAction.bind(null, locale, course.id)}
                          errorMessages={errorMessages}
                        />
                        <FormDialog
                          title={t("editCourse")}
                          description={localizedName(locale, course.title, course.titleAr)}
                          triggerLabel={common("edit")}
                          successMessage={t("courseUpdated")}
                          fields={courseFields()}
                          initial={courseInitial(course)}
                          action={updateCourseAction.bind(null, locale, course.id)}
                          errorMessages={errorMessages}
                          wide
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{canViewAll ? t("enrollments") : t("myTraining")}</CardTitle>
            <CardDescription>{t("trainingHistory")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {allEnrollments.length === 0 ? (
              <div className="p-4">
                <p className="text-xs text-muted-foreground">{t("noEnrollments")}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("course")}</TableHead>
                    {canViewAll && <TableHead>{t("employee")}</TableHead>}
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("score")}</TableHead>
                    {canManage && <TableHead>{common("actions")}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allEnrollments.slice(0, 12).map((enrollment) => {
                    const course = courses.find((item) =>
                      item.enrollments.some((row) => row.id === enrollment.id),
                    );
                    return (
                      <TableRow key={enrollment.id}>
                        <TableCell className="max-w-40 truncate text-xs">
                          {course
                            ? localizedName(locale, course.title, course.titleAr)
                            : "—"}
                        </TableCell>
                        {canViewAll && (
                          <TableCell className="max-w-36 truncate text-xs">
                            {localizedName(
                              locale,
                              `${enrollment.employee.firstName} ${enrollment.employee.lastName}`,
                              `${enrollment.employee.firstNameAr ?? ""} ${enrollment.employee.lastNameAr ?? ""}`.trim(),
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <StatusBadge
                            value={enrollment.status}
                            group="enrollmentStatus"
                          />
                        </TableCell>
                        <TableCell className="text-xs">
                          {enrollment.score ?? "—"}
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <FormDialog
                              title={t("updateEnrollment")}
                              description={
                                course
                                  ? localizedName(locale, course.title, course.titleAr)
                                  : undefined
                              }
                              triggerLabel={common("edit")}
                              successMessage={t("enrollmentUpdated")}
                              fields={enrollmentUpdateFields()}
                              initial={{
                                status: enrollment.status,
                                score:
                                  enrollment.score != null
                                    ? String(enrollment.score)
                                    : "",
                                certificateUrl: enrollment.certificateUrl ?? "",
                                feedback: enrollment.feedback ?? "",
                              }}
                              action={updateEnrollmentAction.bind(
                                null,
                                locale,
                                enrollment.id,
                              )}
                              errorMessages={errorMessages}
                              triggerSize="xs"
                              triggerVariant="ghost"
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
