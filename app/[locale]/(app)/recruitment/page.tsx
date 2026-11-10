import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LiveSearch } from "@/components/shared/live-search";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  FormDialog,
  type FormField,
  type FormValue,
} from "@/components/settings/settings-dialog";
import { formatDate, formatDateTime, formatMoney, formatNumber, localizedName } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BriefcaseBusiness,
  CalendarClock,
  Handshake,
  UserRound,
  Users,
} from "lucide-react";
import {
  createApplicationAction,
  createVacancyAction,
  saveOfferAction,
  scheduleInterviewAction,
  updateApplicationStageAction,
  updateVacancyAction,
} from "./actions";

const STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "EVALUATION", "OFFER", "HIRED"] as const;

export default async function RecruitmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const user = await requirePermission("recruitment.view", locale);
  const t = await getTranslations({ locale, namespace: "recruitment" });
  const common = await getTranslations({ locale, namespace: "common" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const enums = await getTranslations({ locale, namespace: "enums" });
  const canCreate = hasPermission(user, "recruitment.create");
  const canUpdate = hasPermission(user, "recruitment.update");
  const search = query.q?.trim();

  const [
    vacancies,
    applications,
    interviews,
    offers,
    candidateCount,
    departments,
    positions,
    interviewers,
  ] = await Promise.all([
    prisma.jobVacancy.findMany({
      where: search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { titleAr: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
              { requirements: { contains: search, mode: "insensitive" as const } },
              {
                department: {
                  OR: [
                    { name: { contains: search, mode: "insensitive" as const } },
                    { nameAr: { contains: search, mode: "insensitive" as const } },
                  ],
                },
              },
              {
                position: {
                  OR: [
                    { name: { contains: search, mode: "insensitive" as const } },
                    { nameAr: { contains: search, mode: "insensitive" as const } },
                  ],
                },
              },
            ],
          }
        : undefined,
      select: {
        id: true,
        title: true,
        titleAr: true,
        description: true,
        requirements: true,
        departmentId: true,
        positionId: true,
        status: true,
        openings: true,
        salaryMin: true,
        salaryMax: true,
        currency: true,
        closingDate: true,
        department: { select: { name: true, nameAr: true } },
        position: { select: { name: true, nameAr: true } },
        _count: { select: { applications: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.candidateApplication.findMany({
      where: search
        ? {
            OR: [
              {
                candidate: {
                  OR: [
                    { firstName: { contains: search, mode: "insensitive" as const } },
                    { lastName: { contains: search, mode: "insensitive" as const } },
                    { email: { contains: search, mode: "insensitive" as const } },
                    { phone: { contains: search, mode: "insensitive" as const } },
                  ],
                },
              },
              {
                vacancy: {
                  OR: [
                    { title: { contains: search, mode: "insensitive" as const } },
                    { titleAr: { contains: search, mode: "insensitive" as const } },
                  ],
                },
              },
            ],
          }
        : undefined,
      select: {
        id: true,
        stage: true,
        status: true,
        appliedAt: true,
        rating: true,
        notes: true,
        candidate: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        vacancy: { select: { id: true, title: true, titleAr: true } },
        offer: {
          select: {
            id: true,
            salary: true,
            currency: true,
            startDate: true,
            expiresAt: true,
            status: true,
          },
        },
      },
      orderBy: { appliedAt: "desc" },
      take: 80,
    }),
    prisma.interview.findMany({
      where: { scheduledAt: { gte: new Date() }, status: "SCHEDULED" },
      select: {
        id: true,
        scheduledAt: true,
        application: {
          select: {
            candidate: { select: { firstName: true, lastName: true } },
            vacancy: { select: { title: true, titleAr: true } },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 8,
    }),
    prisma.jobOffer.findMany({
      select: {
        id: true,
        salary: true,
        currency: true,
        startDate: true,
        status: true,
        application: {
          select: {
            candidate: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.candidate.count(),
    prisma.department.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, nameAr: true },
      orderBy: { name: "asc" },
    }),
    prisma.position.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true,
        name: true,
        nameAr: true,
        code: true,
        departmentId: true,
        department: { select: { name: true, nameAr: true } },
      },
      orderBy: [{ departmentId: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true, nameAr: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const openVacancies = vacancies.filter((vacancy) => vacancy.status === "OPEN");
  const openings = openVacancies.reduce((sum, vacancy) => sum + vacancy.openings, 0);
  const activePipeline = applications.filter(
    (application) => application.status === "ACTIVE",
  ).length;
  const offersOut = offers.filter((offer) => offer.status === "SENT").length;

  const pipeline = Object.fromEntries(
    STAGES.map((stage) => [
      stage,
      applications.filter((application) => application.stage === stage).length,
    ]),
  ) as Record<(typeof STAGES)[number], number>;

  const departmentOptions = departments.map((department) => ({
    value: department.id,
    label: localizedName(locale, department.name, department.nameAr),
  }));
  const positionOptions = positions.map((position) => ({
    value: position.id,
    label: `${localizedName(locale, position.name, position.nameAr)} — ${localizedName(
      locale,
      position.department.name,
      position.department.nameAr,
    )}`,
  }));
  const interviewerOptions = interviewers.map((interviewer) => ({
    value: interviewer.id,
    label: localizedName(locale, interviewer.name, interviewer.nameAr),
  }));
  const vacancyStatusOptions = ["DRAFT", "OPEN", "ON_HOLD", "CLOSED", "FILLED"].map(
    (value) => ({
      value,
      label: enums(`vacancyStatus.${value}` as never),
    }),
  );
  const stageOptions = [...STAGES, "REJECTED", "WITHDRAWN"].map((value) => ({
    value,
    label: enums(`applicationStage.${value}` as never),
  }));
  const offerStatusOptions = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"].map(
    (value) => ({
      value,
      label: enums(`offerStatus.${value}` as never),
    }),
  );
  const interviewTypeOptions = [
    { value: "VIDEO", label: t("video") },
    { value: "PHONE", label: t("phoneCall") },
    { value: "ONSITE", label: t("onsite") },
  ];
  const errorMessages = {
    invalidPosition: t("invalidPosition"),
    invalidSalary: t("invalidSalary"),
    closedVacancy: t("closedVacancy"),
    duplicateApplication: t("duplicateApplication"),
    invalidDate: t("invalidDate"),
    notFound: common("noResults"),
    unauthorized: common("error"),
    validation: common("requiredField"),
  };
  const activeVacancyOptions = vacancies
    .filter((vacancy) => vacancy.status !== "CLOSED" && vacancy.status !== "FILLED")
    .map((vacancy) => ({
      value: vacancy.id,
      label: localizedName(locale, vacancy.title, vacancy.titleAr),
    }));

  function vacancyFields(): FormField[] {
    return [
      {
        name: "title",
        label: t("vacancyTitle"),
        required: true,
        colSpan: 1,
      },
      {
        name: "titleAr",
        label: t("vacancyTitleAr"),
        dir: "rtl",
        colSpan: 1,
      },
      {
        name: "departmentId",
        label: t("department"),
        type: "select",
        required: true,
        options: departmentOptions,
        placeholder: common("none"),
      },
      {
        name: "positionId",
        label: t("position"),
        type: "select",
        required: true,
        options: positionOptions,
        placeholder: common("none"),
      },
      {
        name: "description",
        label: t("description"),
        type: "textarea",
        required: true,
        colSpan: 2,
      },
      {
        name: "requirements",
        label: t("requirements"),
        type: "textarea",
        required: true,
        colSpan: 2,
      },
      {
        name: "salaryMin",
        label: t("salaryMin"),
        type: "number",
        min: "0",
        step: "0.01",
      },
      {
        name: "salaryMax",
        label: t("salaryMax"),
        type: "number",
        min: "0",
        step: "0.01",
      },
      {
        name: "openings",
        label: t("openings"),
        type: "number",
        min: "1",
        step: "1",
        required: true,
      },
      {
        name: "status",
        label: common("status"),
        type: "select",
        options: vacancyStatusOptions,
      },
      {
        name: "closingDate",
        label: t("closingDate"),
        type: "date",
      },
    ];
  }

  function vacancyInitial(vacancy?: (typeof vacancies)[number]): Record<string, FormValue> {
    return {
      title: vacancy?.title ?? "",
      titleAr: vacancy?.titleAr ?? "",
      departmentId: vacancy?.departmentId ?? "",
      positionId: vacancy?.positionId ?? "",
      description: vacancy?.description ?? "",
      requirements: vacancy?.requirements ?? "",
      salaryMin: vacancy?.salaryMin != null ? String(vacancy.salaryMin) : "",
      salaryMax: vacancy?.salaryMax != null ? String(vacancy.salaryMax) : "",
      openings: String(vacancy?.openings ?? 1),
      status: vacancy?.status ?? "DRAFT",
      closingDate: vacancy?.closingDate
        ? vacancy.closingDate.toISOString().slice(0, 10)
        : "",
    };
  }

  function applicationFields(): FormField[] {
    return [
      {
        name: "vacancyId",
        label: t("selectVacancy"),
        type: "select",
        required: true,
        options: activeVacancyOptions,
        placeholder: common("none"),
        colSpan: 2,
      },
      { name: "firstName", label: t("firstName"), required: true },
      { name: "lastName", label: t("lastName"), required: true },
      { name: "email", label: common("email"), type: "email", required: true },
      { name: "phone", label: common("phone"), type: "tel" },
      {
        name: "experienceYears",
        label: t("experience"),
        type: "number",
        min: "0",
        step: "1",
      },
      { name: "education", label: t("education") },
      { name: "source", label: t("source") },
      { name: "cvUrl", label: t("cv"), type: "url", dir: "ltr" },
      { name: "skills", label: t("skills"), colSpan: 2 },
      {
        name: "notes",
        label: common("notes"),
        type: "textarea",
        colSpan: 2,
      },
    ];
  }

  function applicationInitial(): Record<string, FormValue> {
    return {
      vacancyId: activeVacancyOptions[0]?.value ?? "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      experienceYears: "",
      education: "",
      source: "",
      cvUrl: "",
      skills: "",
      notes: "",
    };
  }

  function stageFields(): FormField[] {
    return [
      {
        name: "stage",
        label: t("stage"),
        type: "select",
        options: stageOptions,
        required: true,
      },
      {
        name: "rating",
        label: t("rating"),
        type: "number",
        min: "0",
        max: "5",
        step: "1",
      },
      {
        name: "notes",
        label: common("notes"),
        type: "textarea",
        colSpan: 2,
      },
    ];
  }

  function interviewFields(): FormField[] {
    return [
      {
        name: "round",
        label: t("interviewRound"),
        type: "number",
        min: "1",
        step: "1",
        required: true,
      },
      {
        name: "scheduledAt",
        label: t("scheduledAt"),
        type: "datetime-local",
        required: true,
      },
      {
        name: "durationMinutes",
        label: t("duration"),
        type: "number",
        min: "15",
        step: "15",
        required: true,
      },
      {
        name: "type",
        label: t("interviewType"),
        type: "select",
        options: interviewTypeOptions,
      },
      {
        name: "interviewerId",
        label: t("interviewer"),
        type: "select",
        options: interviewerOptions,
        placeholder: common("none"),
      },
      { name: "location", label: t("location") },
      { name: "meetingUrl", label: t("meetingUrl"), type: "url", dir: "ltr" },
    ];
  }

  function interviewInitial(): Record<string, FormValue> {
    return {
      round: "1",
      scheduledAt: "",
      durationMinutes: "60",
      type: "VIDEO",
      interviewerId: "",
      location: "",
      meetingUrl: "",
    };
  }

  function offerFields(): FormField[] {
    return [
      {
        name: "salary",
        label: t("salary"),
        type: "number",
        min: "0",
        step: "0.01",
        required: true,
      },
      { name: "currency", label: common("currency"), required: true, dir: "ltr" },
      { name: "startDate", label: t("startDate"), type: "date", required: true },
      { name: "expiresAt", label: t("expiresAt"), type: "date" },
      {
        name: "status",
        label: t("offerStatus"),
        type: "select",
        options: offerStatusOptions,
      },
    ];
  }

  function offerInitial(application: (typeof applications)[number]): Record<string, FormValue> {
    return {
      salary: application.offer ? String(application.offer.salary) : "",
      currency: application.offer?.currency ?? "YER",
      startDate: application.offer
        ? application.offer.startDate.toISOString().slice(0, 10)
        : "",
      expiresAt: application.offer?.expiresAt
        ? application.offer.expiresAt.toISOString().slice(0, 10)
        : "",
      status: application.offer?.status ?? "DRAFT",
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canCreate ? (
            <>
              <FormDialog
                title={t("addVacancy")}
                description={t("subtitle")}
                triggerLabel={t("addVacancy")}
                triggerIcon="plus"
                successMessage={t("vacancyCreated")}
                fields={vacancyFields()}
                initial={vacancyInitial()}
                action={createVacancyAction.bind(null, locale)}
                errorMessages={errorMessages}
                wide
              />
              {activeVacancyOptions.length > 0 && (
                <FormDialog
                  title={t("addCandidate")}
                  description={t("addToVacancy")}
                  triggerLabel={t("addCandidate")}
                  triggerIcon="plus"
                  triggerVariant="outline"
                  successMessage={t("applicationCreated")}
                  fields={applicationFields()}
                  initial={applicationInitial()}
                  action={createApplicationAction.bind(null, locale)}
                  errorMessages={errorMessages}
                  wide
                />
              )}
            </>
          ) : undefined
        }
      />

      <div className="rounded-lg border bg-card p-3">
        <LiveSearch
          initialValue={search}
          placeholder={t("searchPlaceholder")}
          ariaLabel={t("searchPlaceholder")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("openVacancies")}
          value={formatNumber(openVacancies.length, locale)}
          hint={`${formatNumber(openings, locale)} ${t("openings")}`}
          icon={<BriefcaseBusiness className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("totalCandidates")}
          value={formatNumber(candidateCount, locale)}
          hint={nav("recruitment")}
          icon={<Users className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("inPipeline")}
          value={formatNumber(activePipeline, locale)}
          hint={t("pipeline")}
          icon={<UserRound className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("offersOut")}
          value={formatNumber(offersOut, locale)}
          hint={t("offer")}
          icon={<Handshake className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-6">
        {STAGES.map((stage) => (
          <Card key={stage} className="py-3">
            <CardContent className="px-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {stage.toLowerCase()}
              </p>
              <p className="mt-1 text-xl font-semibold">{pipeline[stage]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("vacancies")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {vacancies.length === 0 ? (
              <div className="p-6">
                <EmptyState title={t("noVacancies")} />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("vacancy")}</TableHead>
                    <TableHead>{t("department")}</TableHead>
                    <TableHead>{t("openings")}</TableHead>
                    <TableHead>{t("salaryRange")}</TableHead>
                    <TableHead>{t("closingDate")}</TableHead>
                    <TableHead>{common("status")}</TableHead>
                    {canUpdate && <TableHead>{common("actions")}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vacancies.map((vacancy) => (
                    <TableRow key={vacancy.id}>
                      <TableCell>
                        <p className="text-sm font-medium">
                          {localizedName(locale, vacancy.title, vacancy.titleAr)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {vacancy._count.applications} {t("applications")}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {localizedName(
                          locale,
                          vacancy.department.name,
                          vacancy.department.nameAr,
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{vacancy.openings}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatMoney(vacancy.salaryMin, locale, vacancy.currency)} –{" "}
                        {formatMoney(vacancy.salaryMax, locale, vacancy.currency)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(vacancy.closingDate, locale)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={vacancy.status} group="vacancyStatus" />
                      </TableCell>
                      {canUpdate && (
                        <TableCell>
                          <FormDialog
                            title={t("editVacancy")}
                            description={t("subtitle")}
                            triggerLabel={common("edit")}
                            successMessage={t("vacancyUpdated")}
                            fields={vacancyFields()}
                            initial={vacancyInitial(vacancy)}
                            action={updateVacancyAction.bind(null, locale, vacancy.id)}
                            errorMessages={errorMessages}
                            triggerSize="xs"
                            triggerVariant="ghost"
                            wide
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

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("scheduleInterview")}</CardTitle>
              <CardDescription>{t("interview")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {interviews.length === 0 ? (
                <p className="text-xs text-muted-foreground">{common("noResults")}</p>
              ) : (
                interviews.map((interview) => (
                  <div key={interview.id} className="rounded-md border p-2.5 text-sm">
                    <p className="truncate font-medium">
                      {interview.application.candidate.firstName}{" "}
                      {interview.application.candidate.lastName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {localizedName(
                        locale,
                        interview.application.vacancy.title,
                        interview.application.vacancy.titleAr,
                      )}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5" />
                      {formatDateTime(interview.scheduledAt, locale)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("offersOut")}</CardTitle>
              <CardDescription>{t("offer")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {offers.length === 0 ? (
                <p className="text-xs text-muted-foreground">{common("noResults")}</p>
              ) : (
                offers.map((offer) => (
                  <div key={offer.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {offer.application.candidate.firstName}{" "}
                        {offer.application.candidate.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(offer.salary, locale, offer.currency)} ·{" "}
                        {formatDate(offer.startDate, locale)}
                      </p>
                    </div>
                    <Badge variant="outline">{offer.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("applications")}</CardTitle>
          <CardDescription>{t("pipeline")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {applications.length === 0 ? (
            <div className="p-6">
              <EmptyState title={t("noApplications")} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("candidate")}</TableHead>
                  <TableHead>{t("vacancy")}</TableHead>
                  <TableHead>{t("stage")}</TableHead>
                  <TableHead>{t("appliedOn")}</TableHead>
                  <TableHead>{t("rating")}</TableHead>
                  <TableHead>{common("status")}</TableHead>
                  {canUpdate && <TableHead>{common("actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <p className="text-sm font-medium">
                        {application.candidate.firstName}{" "}
                        {application.candidate.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {application.candidate.email}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {localizedName(
                        locale,
                        application.vacancy.title,
                        application.vacancy.titleAr,
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={application.stage} group="applicationStage" />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(application.appliedAt, locale)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {application.rating ? `${application.rating}/5` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{application.status}</Badge>
                    </TableCell>
                    {canUpdate && (
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <FormDialog
                            title={t("moveStage")}
                            description={`${application.candidate.firstName} ${application.candidate.lastName}`}
                            triggerLabel={t("moveStage")}
                            successMessage={t("stageUpdated")}
                            fields={stageFields()}
                            initial={{
                              stage: application.stage,
                              rating:
                                application.rating != null
                                  ? String(application.rating)
                                  : "",
                              notes: application.notes ?? "",
                            }}
                            action={updateApplicationStageAction.bind(
                              null,
                              locale,
                              application.id,
                            )}
                            errorMessages={errorMessages}
                            triggerSize="xs"
                            triggerVariant="ghost"
                          />
                          {application.status === "ACTIVE" && (
                            <>
                              <FormDialog
                                title={t("scheduleInterview")}
                                description={`${application.candidate.firstName} ${application.candidate.lastName}`}
                                triggerLabel={t("interview")}
                                triggerIcon="plus"
                                successMessage={t("interviewScheduled")}
                                fields={interviewFields()}
                                initial={interviewInitial()}
                                action={scheduleInterviewAction.bind(
                                  null,
                                  locale,
                                  application.id,
                                )}
                                errorMessages={errorMessages}
                                triggerSize="xs"
                                triggerVariant="ghost"
                              />
                              <FormDialog
                                title={application.offer ? t("updateOffer") : t("makeOffer")}
                                description={`${application.candidate.firstName} ${application.candidate.lastName}`}
                                triggerLabel={application.offer ? t("updateOffer") : t("makeOffer")}
                                triggerIcon={application.offer ? "edit" : "plus"}
                                successMessage={
                                  application.offer ? t("offerUpdated") : t("offerCreated")
                                }
                                fields={offerFields()}
                                initial={offerInitial(application)}
                                action={saveOfferAction.bind(null, locale, application.id)}
                                errorMessages={errorMessages}
                                triggerSize="xs"
                                triggerVariant="ghost"
                              />
                            </>
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
  );
}
