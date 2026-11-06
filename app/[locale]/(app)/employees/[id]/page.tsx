import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  formatDate,
  formatMoney,
  formatNumber,
  localizedName,
} from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  FileText,
  Laptop,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requirePermission("employee.view", locale);
  const t = await getTranslations({ locale, namespace: "employees" });
  const common = await getTranslations({ locale, namespace: "common" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const leaveT = await getTranslations({ locale, namespace: "leave" });
  const attendanceT = await getTranslations({ locale, namespace: "attendance" });
  const payrollT = await getTranslations({ locale, namespace: "payroll" });

  const canViewAll = hasPermission(user, "employee.view_all");
  const employee = await prisma.employee.findFirst({
    where: { id, deletedAt: null },
    include: {
      employments: {
        orderBy: { isCurrent: "desc" },
        include: {
          department: true,
          position: true,
          branch: true,
          workLocation: true,
        },
      },
      manager: true,
      directReports: {
        where: { deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          firstNameAr: true,
          lastNameAr: true,
          employeeNo: true,
          status: true,
        },
      },
      contacts: true,
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      bankAccounts: true,
      salaries: {
        include: { component: true },
        orderBy: { effectiveFrom: "desc" },
      },
      leaveBalances: {
        where: { year: new Date().getUTCFullYear() },
        include: { leaveType: true },
      },
      attendances: { orderBy: { date: "desc" }, take: 8 },
      leaveRequests: {
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { leaveType: true },
      },
      payrollItems: {
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { run: { include: { period: true } } },
      },
      assetAssignments: {
        where: { returnedAt: null },
        include: { asset: true },
      },
      skills: { include: { skill: true } },
      onboarding: true,
    },
  });

  if (!employee) notFound();

  const isSelf = user.employeeId === employee.id;
  const isDirectManager = user.employeeId === employee.managerId;
  if (!canViewAll && !isSelf && !isDirectManager) notFound();

  const currentEmployment =
    employee.employments.find((employment) => employment.isCurrent) ?? employee.employments[0];
  const name = `${employee.firstName} ${employee.lastName}`;
  const nameAr = `${employee.firstNameAr ?? ""} ${employee.lastNameAr ?? ""}`.trim();
  const displayName = localizedName(locale, name, nameAr);
  const canViewSalary = hasPermission(user, "employee.view_salary") || isSelf;
  const canViewDocuments = hasPermission(user, "employee.view_document") || isSelf;

  const totalFixed = employee.salaries
    .filter((salary) => !salary.effectiveTo)
    .reduce((sum, salary) => sum + Number(salary.amount), 0);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ms-2">
        <Link href="/employees">
          <ArrowLeft className="size-4" /> {common("back")}
        </Link>
      </Button>

      <PageHeader
        title={displayName}
        description={`${employee.employeeNo} · ${currentEmployment ? localizedName(locale, currentEmployment.position.name, currentEmployment.position.nameAr) : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={employee.status} group="employmentStatus" />
            {hasPermission(user, "employee.update") && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/employees/${employee.id}/edit`}>{common("edit")}</Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("personalInfo")}</CardTitle>
            <CardDescription>{t("overview")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar className="size-16">
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {employee.firstName[0]}
                  {employee.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-1">
                <p className="text-lg font-semibold">{displayName}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5" /> {employee.email}
                  </span>
                  {employee.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="size-3.5" /> {employee.phone}
                    </span>
                  )}
                  {employee.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5" /> {employee.city}, {employee.country}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Separator />
            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Info label={t("gender")}>
                <StatusBadge value={employee.gender} group="gender" />
              </Info>
              <Info label={t("dob")}>{formatDate(employee.dateOfBirth, locale)}</Info>
              <Info label={t("nationality")}>{employee.nationality ?? "—"}</Info>
              <Info label={t("nationalId")}>{employee.nationalId ?? "—"}</Info>
              <Info label={t("maritalStatus")}>
                <StatusBadge value={employee.maritalStatus} group="maritalStatus" />
              </Info>
              <Info label={t("personalEmail")}>{employee.personalEmail ?? "—"}</Info>
              <Info label={t("address")}>{employee.address ?? "—"}</Info>
              <Info label={t("emergencyContact")}>
                {employee.emergencyName ?? "—"}
                {employee.emergencyPhone ? ` · ${employee.emergencyPhone}` : ""}
              </Info>
              <Info label={t("hireDate")}>{formatDate(employee.hireDate, locale)}</Info>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("employmentInfo")}</CardTitle>
            <CardDescription>{t("currentEmployment")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {currentEmployment ? (
              <>
                <InfoRow
                  icon={<Building2 className="size-4" />}
                  label={t("department")}
                  value={localizedName(locale, currentEmployment.department.name, currentEmployment.department.nameAr)}
                />
                <InfoRow
                  icon={<BriefcaseBusiness className="size-4" />}
                  label={t("position")}
                  value={localizedName(locale, currentEmployment.position.name, currentEmployment.position.nameAr)}
                />
                <InfoRow
                  icon={<MapPin className="size-4" />}
                  label={t("workLocation")}
                  value={
                    currentEmployment.workLocation
                      ? localizedName(locale, currentEmployment.workLocation.name, currentEmployment.workLocation.nameAr)
                      : localizedName(locale, currentEmployment.branch.name, currentEmployment.branch.nameAr)
                  }
                />
                <InfoRow
                  icon={<Users className="size-4" />}
                  label={t("manager")}
                  value={
                    employee.manager
                      ? localizedName(
                          locale,
                          `${employee.manager.firstName} ${employee.manager.lastName}`,
                          `${employee.manager.firstNameAr ?? ""} ${employee.manager.lastNameAr ?? ""}`.trim(),
                        )
                      : "—"
                  }
                />
                <InfoRow
                  icon={<CalendarDays className="size-4" />}
                  label={t("employmentType")}
                  value={<StatusBadge value={currentEmployment.employmentType} group="employmentType" />}
                />
                <InfoRow
                  icon={<CalendarDays className="size-4" />}
                  label={t("contractEnd")}
                  value={formatDate(currentEmployment.contractEnd, locale)}
                />
                <InfoRow
                  icon={<ShieldCheck className="size-4" />}
                  label={t("probationEnd")}
                  value={formatDate(currentEmployment.probationEnd, locale)}
                />
              </>
            ) : (
              <p className="text-muted-foreground">{common("noResults")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{t("salaryInfo")}</CardTitle>
              <CardDescription>{t("basicSalary")}</CardDescription>
            </div>
            <Wallet className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {canViewSalary ? (
              <>
                <div>
                  <p className="text-2xl font-semibold tracking-tight">
                    {formatMoney(currentEmployment?.basicSalary ?? 0, locale, currentEmployment?.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("salaryComponents")} · {formatMoney(totalFixed, locale, "YER")}
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  {employee.salaries
                    .filter((salary) => !salary.effectiveTo)
                    .slice(0, 6)
                    .map((salary) => (
                      <div key={salary.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-muted-foreground">
                          {localizedName(locale, salary.component.name, salary.component.nameAr)}
                        </span>
                        <span className="shrink-0 font-medium">
                          {formatMoney(salary.amount, locale, "YER")}
                        </span>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                <ShieldCheck className="size-4" /> {t("salaryHidden")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{leaveT("balance")}</CardTitle>
            <CardDescription>{leaveT("year")} {new Date().getUTCFullYear()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {employee.leaveBalances.length === 0 ? (
              <p className="text-xs text-muted-foreground">{leaveT("noBalances")}</p>
            ) : (
              employee.leaveBalances.slice(0, 5).map((balance) => {
                const remaining =
                  Number(balance.entitledDays) +
                  Number(balance.carriedDays) -
                  Number(balance.usedDays) -
                  Number(balance.pendingDays);
                const used = Number(balance.usedDays) + Number(balance.pendingDays);
                const total = Number(balance.entitledDays) + Number(balance.carriedDays);
                return (
                  <div key={balance.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">
                        {localizedName(locale, balance.leaveType.name, balance.leaveType.nameAr)}
                      </span>
                      <span className="text-muted-foreground">
                        {formatNumber(remaining, locale)} / {formatNumber(total, locale)}
                      </span>
                    </div>
                    <Progress value={total > 0 ? (used / total) * 100 : 0} className="h-1.5" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("directReports")}</CardTitle>
            <CardDescription>{formatNumber(employee.directReports.length, locale)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {employee.directReports.length === 0 ? (
              <p className="text-xs text-muted-foreground">{common("noResults")}</p>
            ) : (
              employee.directReports.slice(0, 6).map((report) => (
                <Link
                  key={report.id}
                  href={`/employees/${report.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm hover:bg-muted"
                >
                  <span className="truncate">
                    {localizedName(
                      locale,
                      `${report.firstName} ${report.lastName}`,
                      `${report.firstNameAr ?? ""} ${report.lastNameAr ?? ""}`.trim(),
                    )}
                  </span>
                  <StatusBadge value={report.status} group="employmentStatus" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{attendanceT("myHistory")}</CardTitle>
              <CardDescription>{attendanceT("title")}</CardDescription>
            </div>
            <CalendarDays className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {employee.attendances.length === 0 ? (
              <EmptyState title={attendanceT("noRecords")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{common("date")}</TableHead>
                    <TableHead>{attendanceT("status")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{attendanceT("checkInTime")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{attendanceT("checkOutTime")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.attendances.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-sm">{formatDate(record.date, locale)}</TableCell>
                      <TableCell>
                        <StatusBadge value={record.status} group="attendanceStatus" />
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {record.checkIn
                          ? new Intl.DateTimeFormat("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Aden",
                            }).format(record.checkIn)
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {record.checkOut
                          ? new Intl.DateTimeFormat("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Aden",
                            }).format(record.checkOut)
                          : "—"}
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
            <CardTitle>{leaveT("myRequests")}</CardTitle>
            <CardDescription>{leaveT("title")}</CardDescription>
          </CardHeader>
          <CardContent>
            {employee.leaveRequests.length === 0 ? (
              <EmptyState title={leaveT("noRequests")} />
            ) : (
              <div className="space-y-2">
                {employee.leaveRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {localizedName(locale, request.leaveType.name, request.leaveType.nameAr)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(request.startDate, locale)} – {formatDate(request.endDate, locale)} ·{" "}
                        {formatNumber(request.days, locale)} {leaveT("days")}
                      </p>
                    </div>
                    <StatusBadge value={request.status} group="leaveStatus" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("documents")}</CardTitle>
            <CardDescription>{formatNumber(employee.documents.length, locale)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!canViewDocuments ? (
              <p className="text-xs text-muted-foreground">{t("salaryHidden")}</p>
            ) : employee.documents.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noDocuments")}</p>
            ) : (
              employee.documents.slice(0, 5).map((document) => (
                <div key={document.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{document.title}</p>
                    <p className="text-xs text-muted-foreground">{document.type}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{nav("assets")}</CardTitle>
            <CardDescription>{formatNumber(employee.assetAssignments.length, locale)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {employee.assetAssignments.length === 0 ? (
              <p className="text-xs text-muted-foreground">{common("noResults")}</p>
            ) : (
              employee.assetAssignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <Laptop className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{assignment.asset.name}</p>
                    <p className="text-xs text-muted-foreground">{assignment.asset.assetTag}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{nav("training")}</CardTitle>
            <CardDescription>{t("overview")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {employee.skills.length === 0 ? (
                <p className="text-xs text-muted-foreground">{common("noResults")}</p>
              ) : (
                employee.skills.map((skill) => (
                  <Badge key={skill.id} variant="secondary">
                    {localizedName(locale, skill.skill.name, skill.skill.nameAr)} · {skill.level}/5
                  </Badge>
                ))
              )}
            </div>
            {employee.onboarding && (
              <div className="space-y-1.5 rounded-md border p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span>{nav("onboarding")}</span>
                  <span>{employee.onboarding.progress}%</span>
                </div>
                <Progress value={employee.onboarding.progress} className="h-1.5" />
              </div>
            )}
            {canViewSalary && employee.payrollItems.length > 0 && (
              <div className="space-y-1.5 border-t pt-2">
                <p className="text-xs font-medium">{payrollT("myPayslips")}</p>
                {employee.payrollItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.run.period.name}</span>
                    <span className="font-medium">{formatMoney(item.netSalary, locale, item.currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon} {label}
      </span>
      <span className="text-end font-medium">{value}</span>
    </div>
  );
}
