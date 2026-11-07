import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsDialog, type SettingsField } from "@/components/settings/settings-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate, formatNumber, localizedName } from "@/lib/format";
import { Button } from "@/components/ui/button";
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
import {
  Building2,
  CalendarDays,
  KeyRound,
  MapPin,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import {
  createBranchAction,
  createHolidayAction,
  createLeaveTypeAction,
  createSalaryComponentAction,
  createScheduleAction,
  updateBranchAction,
  updateCompanyAction,
  updateHolidayAction,
  updateLeaveTypeAction,
  updateRolePermissionsAction,
  updateSalaryComponentAction,
  updateScheduleAction,
  updateUserAction,
} from "./actions";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requirePermission("settings.view", locale);
  const t = await getTranslations({ locale, namespace: "settings" });
  const common = await getTranslations({ locale, namespace: "common" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const employeesT = await getTranslations({ locale, namespace: "employees" });
  const attendanceT = await getTranslations({ locale, namespace: "attendance" });
  const payrollT = await getTranslations({ locale, namespace: "payroll" });

  const [
    company,
    branches,
    users,
    roles,
    leaveTypes,
    components,
    schedules,
    holidays,
    settings,
    permissions,
  ] = await Promise.all([
      prisma.company.findFirst({ where: { isActive: true } }),
      prisma.branch.findMany({
        where: { isActive: true },
        include: { _count: { select: { departments: true, employments: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { deletedAt: null },
        include: { roles: { include: { role: true } }, employee: true },
        orderBy: { name: "asc" },
      }),
      prisma.role.findMany({
        include: {
          _count: { select: { permissions: true, users: true } },
          permissions: { include: { permission: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.salaryComponent.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.workSchedule.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.holiday.findMany({ orderBy: { date: "asc" } }),
      prisma.systemSetting.findMany({ orderBy: { key: "asc" } }),
      prisma.permission.findMany({ orderBy: [{ module: "asc" }, { code: "asc" }] }),
    ]);

  const canManageSettings = hasPermission(user, "settings.manage");
  const canManageUsers = hasPermission(user, "user.manage");
  const canManageRoles = hasPermission(user, "role.manage");
  const actorIsSuper = user.roles.some((role) => role.code === "SUPER_ADMIN");

  const moduleKeys = [
    "dashboard",
    "employees",
    "departments",
    "positions",
    "attendance",
    "leave",
    "payroll",
    "recruitment",
    "onboarding",
    "offboarding",
    "performance",
    "training",
    "assets",
    "requests",
    "reports",
    "settings",
    "audit",
    "notifications",
    "system",
  ];
  const moduleLabels: Record<string, string> = {};
  for (const key of moduleKeys) moduleLabels[key] = nav(key);

  const permissionOptions = permissions.map((permission) => ({
    value: permission.code,
    label: localizedName(locale, permission.name, permission.nameAr),
    group: moduleLabels[permission.module] ?? permission.module,
  }));
  const roleOptions = roles
    .filter((role) => actorIsSuper || role.code !== "SUPER_ADMIN")
    .map((role) => ({
      value: role.code,
      label: localizedName(locale, role.name, role.nameAr),
    }));
  const weekdayOptions = Array.from({ length: 7 }, (_, index) => ({
    value: String(index),
    label: attendanceT(`weekday.${index}`),
  }));

  const companyFields: SettingsField[] = [
    { name: "name", label: t("companyName"), required: true },
    { name: "nameAr", label: t("companyNameAr"), required: true, dir: "rtl" },
    { name: "legalName", label: t("legalName") },
    { name: "taxId", label: t("taxId") },
    { name: "email", label: employeesT("email"), type: "email" },
    { name: "phone", label: employeesT("phone") },
    { name: "currency", label: t("currency"), required: true, max: "3" },
    { name: "timezone", label: t("timezone"), required: true },
    { name: "address", label: employeesT("address"), colSpan: 2 },
    { name: "city", label: employeesT("city") },
    { name: "country", label: employeesT("country") },
  ];

  const branchFields: SettingsField[] = [
    { name: "name", label: t("branchName"), required: true },
    { name: "nameAr", label: t("branchNameAr"), required: true, dir: "rtl" },
    { name: "code", label: t("branchCode"), required: true, dir: "ltr" },
    { name: "phone", label: employeesT("phone") },
    { name: "address", label: employeesT("address"), colSpan: 2 },
    { name: "isActive", label: common("active"), type: "switch" },
  ];

  const leaveTypeFields: SettingsField[] = [
    { name: "code", label: common("code"), required: true, dir: "ltr" },
    { name: "name", label: common("name"), required: true },
    { name: "nameAr", label: common("nameAr"), required: true, dir: "rtl" },
    { name: "color", label: t("color"), type: "text", dir: "ltr" },
    { name: "maxDaysPerYear", label: t("maxDaysPerYear"), type: "number", min: "0", step: "1" },
    { name: "isPaid", label: t("isPaid"), type: "switch" },
    { name: "requiresApproval", label: t("requiresApproval"), type: "switch" },
    { name: "requiresHrApproval", label: t("requiresHrApproval"), type: "switch" },
    { name: "carryOver", label: t("carryOver"), type: "switch" },
    { name: "isActive", label: common("active"), type: "switch" },
  ];

  const salaryComponentFields: SettingsField[] = [
    { name: "code", label: common("code"), required: true, dir: "ltr" },
    { name: "name", label: common("name"), required: true },
    { name: "nameAr", label: common("nameAr"), required: true, dir: "rtl" },
    {
      name: "type",
      label: t("componentType"),
      type: "select",
      options: [
        { value: "EARNING", label: payrollT("typeEarning") },
        { value: "DEDUCTION", label: payrollT("typeDeduction") },
      ],
    },
    {
      name: "calculationType",
      label: payrollT("calculationType"),
      type: "select",
      options: [
        { value: "FIXED", label: payrollT("fixed") },
        { value: "PERCENTAGE", label: payrollT("percentage") },
      ],
    },
    { name: "percentage", label: payrollT("percentage"), type: "number", min: "0", step: "0.01" },
    { name: "sortOrder", label: t("sortOrder"), type: "number", min: "0", step: "1" },
    { name: "isTaxable", label: payrollT("taxable"), type: "switch" },
    { name: "isStatutory", label: payrollT("statutory"), type: "switch" },
    { name: "isActive", label: common("active"), type: "switch" },
  ];

  const scheduleFields: SettingsField[] = [
    { name: "name", label: common("name"), required: true },
    { name: "nameAr", label: common("nameAr"), required: true, dir: "rtl" },
    { name: "startTime", label: attendanceT("startTime"), type: "time", required: true, dir: "ltr" },
    { name: "endTime", label: attendanceT("endTime"), type: "time", required: true, dir: "ltr" },
    { name: "graceMinutes", label: attendanceT("graceMinutes"), type: "number", min: "0", step: "1" },
    { name: "workDays", label: attendanceT("workDays"), type: "checkboxes", options: weekdayOptions, colSpan: 2 },
    { name: "isDefault", label: t("isDefault"), type: "switch" },
    { name: "isActive", label: common("active"), type: "switch" },
  ];

  const holidayFields: SettingsField[] = [
    { name: "name", label: common("name"), required: true },
    { name: "nameAr", label: common("nameAr"), required: true, dir: "rtl" },
    { name: "date", label: common("date"), type: "date", required: true },
    { name: "year", label: t("year"), type: "number", min: "2000", max: "2100", step: "1" },
    { name: "isRecurring", label: t("recurring"), type: "switch" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-4" /> {t("company")}
              </CardTitle>
              <CardDescription>{t("general")}</CardDescription>
            </div>
            {company && canManageSettings && (
              <SettingsDialog
                title={t("editCompany")}
                description={t("general")}
                triggerLabel={t("editCompany")}
                successMessage={t("companyUpdated")}
                fields={companyFields}
                initial={{
                  name: company.name,
                  nameAr: company.nameAr,
                  legalName: company.legalName ?? "",
                  taxId: company.taxId ?? "",
                  email: company.email ?? "",
                  phone: company.phone ?? "",
                  currency: company.currency,
                  timezone: company.timezone,
                  address: company.address ?? "",
                  city: company.city ?? "",
                  country: company.country,
                }}
                action={updateCompanyAction.bind(null, locale, company.id)}
              />
            )}
          </CardHeader>
          <CardContent>
            {company ? (
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <Info label={t("companyName")} value={company.name} />
                <Info label={t("companyNameAr")} value={company.nameAr} />
                <Info label={t("legalName")} value={company.legalName ?? "—"} />
                <Info label={t("taxId")} value={company.taxId ?? "—"} />
                <Info label={t("currency")} value={company.currency} />
                <Info label={t("timezone")} value={company.timezone} />
                <Info label={employeesT("email")} value={company.email ?? "—"} />
                <Info label={employeesT("phone")} value={company.phone ?? "—"} />
                <Info
                  label={employeesT("address")}
                  value={`${company.address ?? ""}${company.city ? `, ${company.city}` : ""}`}
                />
                <Info label={employeesT("country")} value={company.country} />
              </dl>
            ) : (
              <EmptyState title={common("noResults")} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" /> {t("security")}
            </CardTitle>
            <CardDescription>{t("account")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/profile#password">{t("changePassword")}</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/profile#sessions">{t("sessions")}</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/audit">{nav("audit")}</Link>
            </Button>
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mb-1 size-4" />
              {t("permissionHint")}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-4" /> {t("branches")}
              </CardTitle>
              <CardDescription>{t("branchName")}</CardDescription>
            </div>
            {company && canManageSettings && (
              <SettingsDialog
                title={t("addBranch")}
                description={t("branchName")}
                triggerLabel={t("addBranch")}
                triggerIcon="plus"
                successMessage={t("branchCreated")}
                fields={branchFields}
                initial={{
                  name: "",
                  nameAr: "",
                  code: "",
                  phone: "",
                  address: "",
                  isActive: true,
                }}
                action={createBranchAction.bind(null, locale, company.id)}
              />
            )}
          </CardHeader>
          <CardContent className="p-0">
            {branches.length === 0 ? (
              <div className="p-4">
                <EmptyState title={common("noResults")} />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("branchName")}</TableHead>
                    <TableHead>{t("branchCode")}</TableHead>
                    <TableHead>{employeesT("department")}</TableHead>
                    <TableHead>{employeesT("title")}</TableHead>
                    <TableHead>{common("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell className="text-sm font-medium">
                        {localizedName(locale, branch.name, branch.nameAr)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {branch.code}
                      </TableCell>
                      <TableCell>{formatNumber(branch._count.departments, locale)}</TableCell>
                      <TableCell>{formatNumber(branch._count.employments, locale)}</TableCell>
                      <TableCell>
                        {canManageSettings && (
                          <SettingsDialog
                            title={t("editBranch")}
                            triggerLabel={common("edit")}
                            triggerSize="xs"
                            successMessage={t("branchUpdated")}
                            fields={branchFields}
                            initial={{
                              name: branch.name,
                              nameAr: branch.nameAr,
                              code: branch.code,
                              phone: branch.phone ?? "",
                              address: branch.address ?? "",
                              isActive: branch.isActive,
                            }}
                            action={updateBranchAction.bind(null, locale, branch.id)}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4" /> {t("users")}
              </CardTitle>
              <CardDescription>{t("usersList")}</CardDescription>
            </div>
            {canManageUsers && (
              <Button asChild size="sm" variant="outline">
                <Link href="/users">{common("viewAll")}</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("lastLogin")}</TableHead>
                  <TableHead>{common("status")}</TableHead>
                  <TableHead>{common("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.slice(0, 20).map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <p className="text-sm font-medium">
                        {localizedName(locale, account.name, account.nameAr)}
                      </p>
                      <p className="text-xs text-muted-foreground">{account.email}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {account.roles.map((userRole) => (
                          <Badge key={userRole.roleId} variant="outline" className="text-[10px]">
                            {localizedName(
                              locale,
                              userRole.role.name,
                              userRole.role.nameAr,
                            )}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(account.lastLoginAt, locale, {
                        day: "2-digit",
                        month: "short",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.isActive ? "secondary" : "outline"}>
                        {account.isActive ? common("active") : common("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canManageUsers &&
                        account.id !== user.id &&
                        (actorIsSuper ||
                          !account.roles.some(
                            (userRole) => userRole.role.code === "SUPER_ADMIN",
                          )) && (
                          <SettingsDialog
                            title={t("editUser")}
                            triggerLabel={common("edit")}
                            triggerSize="xs"
                            successMessage={t("userUpdated")}
                            fields={[
                              { name: "name", label: common("name"), required: true },
                              {
                                name: "nameAr",
                                label: common("nameAr"),
                                dir: "rtl",
                              },
                              {
                                name: "roleCodes",
                                label: t("role"),
                                type: "checkboxes",
                                options: roleOptions,
                                colSpan: 2,
                              },
                              {
                                name: "isActive",
                                label: common("active"),
                                type: "switch",
                              },
                            ]}
                            initial={{
                              name: account.name,
                              nameAr: account.nameAr ?? "",
                              roleCodes: account.roles
                                .map((userRole) => userRole.role.code)
                                .join(","),
                              isActive: account.isActive,
                            }}
                            action={updateUserAction.bind(null, locale, account.id)}
                          />
                        )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4" /> {t("roles")}
            </CardTitle>
            <CardDescription>{t("rolePermissions")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {roles.map((role) => (
              <div key={role.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
                <div>
                  <p className="font-medium">
                    {localizedName(locale, role.name, role.nameAr)}
                  </p>
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {role._count.permissions} {t("permissionsCount")}
                  </span>
                  <Badge variant="outline">
                    {role._count.users} {t("users")}
                  </Badge>
                  {canManageRoles && role.code !== "SUPER_ADMIN" && (
                    <SettingsDialog
                      title={t("editRolePermissions")}
                      description={localizedName(locale, role.name, role.nameAr)}
                      triggerLabel={common("edit")}
                      triggerSize="xs"
                      successMessage={t("roleUpdated")}
                      wide
                      fields={[
                        {
                          name: "permissions",
                          label: t("permissions"),
                          type: "checkboxes",
                          options: permissionOptions,
                          colSpan: 2,
                        },
                      ]}
                      initial={{
                        permissions: role.permissions
                          .map((rolePermission) => rolePermission.permission.code)
                          .join(","),
                      }}
                      action={updateRolePermissionsAction.bind(null, locale, role.id)}
                    />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-4" /> {nav("leave")}
              </CardTitle>
              <CardDescription>{t("system")}</CardDescription>
            </div>
            {company && canManageSettings && (
              <SettingsDialog
                title={t("addLeaveType")}
                triggerLabel={t("addLeaveType")}
                triggerIcon="plus"
                successMessage={t("leaveTypeCreated")}
                fields={leaveTypeFields}
                initial={{
                  code: "",
                  name: "",
                  nameAr: "",
                  color: "#2563eb",
                  maxDaysPerYear: "0",
                  isPaid: true,
                  requiresApproval: true,
                  requiresHrApproval: false,
                  carryOver: false,
                  isActive: true,
                }}
                action={createLeaveTypeAction.bind(null, locale, company.id)}
              />
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {leaveTypes.map((type) => (
              <div key={type.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
                <div>
                  <p className="font-medium">
                    {localizedName(locale, type.name, type.nameAr)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {type.code} · {type.maxDaysPerYear ?? "—"} {common("date")}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {type.isPaid && <Badge variant="secondary">{common("active")}</Badge>}
                  {type.requiresHrApproval && (
                    <Badge variant="outline">{t("roles")}</Badge>
                  )}
                  {canManageSettings && (
                    <SettingsDialog
                      title={t("editLeaveType")}
                      triggerLabel={common("edit")}
                      triggerSize="xs"
                      successMessage={t("leaveTypeUpdated")}
                      fields={leaveTypeFields}
                      initial={{
                        code: type.code,
                        name: type.name,
                        nameAr: type.nameAr,
                        color: type.color,
                        maxDaysPerYear: String(type.maxDaysPerYear ?? ""),
                        isPaid: type.isPaid,
                        requiresApproval: type.requiresApproval,
                        requiresHrApproval: type.requiresHrApproval,
                        carryOver: type.carryOver,
                        isActive: type.isActive,
                      }}
                      action={updateLeaveTypeAction.bind(null, locale, type.id)}
                    />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="salary-components">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-4" /> {nav("payroll")}
              </CardTitle>
              <CardDescription>{t("system")}</CardDescription>
            </div>
            {company && canManageSettings && (
              <SettingsDialog
                title={t("addSalaryComponent")}
                triggerLabel={t("addSalaryComponent")}
                triggerIcon="plus"
                successMessage={t("salaryComponentCreated")}
                fields={salaryComponentFields}
                initial={{
                  code: "",
                  name: "",
                  nameAr: "",
                  type: "EARNING",
                  calculationType: "FIXED",
                  percentage: "",
                  sortOrder: "0",
                  isTaxable: true,
                  isStatutory: false,
                  isActive: true,
                }}
                action={createSalaryComponentAction.bind(null, locale, company.id)}
              />
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {components.map((component) => (
              <div key={component.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
                <div>
                  <p className="font-medium">
                    {localizedName(locale, component.name, component.nameAr)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {component.code} · {component.type}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline">
                    {component.calculationType === "FIXED"
                      ? component.type
                      : `${component.percentage}%`}
                  </Badge>
                  {canManageSettings && (
                    <SettingsDialog
                      title={t("editSalaryComponent")}
                      triggerLabel={common("edit")}
                      triggerSize="xs"
                      successMessage={t("salaryComponentUpdated")}
                      fields={salaryComponentFields}
                      initial={{
                        code: component.code,
                        name: component.name,
                        nameAr: component.nameAr,
                        type: component.type,
                        calculationType: component.calculationType,
                        percentage:
                          component.percentage === null
                            ? ""
                            : String(component.percentage),
                        sortOrder: String(component.sortOrder),
                        isTaxable: component.isTaxable,
                        isStatutory: component.isStatutory,
                        isActive: component.isActive,
                      }}
                      action={updateSalaryComponentAction.bind(
                        null,
                        locale,
                        component.id,
                      )}
                    />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4" /> {t("system")}
            </CardTitle>
            <CardDescription>{t("general")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {nav("attendance")}
                </p>
                {company && canManageSettings && (
                  <SettingsDialog
                    title={t("addSchedule")}
                    triggerLabel={t("addSchedule")}
                    triggerIcon="plus"
                    triggerSize="xs"
                    successMessage={t("scheduleCreated")}
                    fields={scheduleFields}
                    initial={{
                      name: "",
                      nameAr: "",
                      startTime: "08:00",
                      endTime: "17:00",
                      graceMinutes: "10",
                      workDays: "0,1,2,3,4",
                      isDefault: false,
                      isActive: true,
                    }}
                    action={createScheduleAction.bind(null, locale, company.id)}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {localizedName(locale, schedule.name, schedule.nameAr)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {schedule.startTime} – {schedule.endTime}
                      </p>
                    </div>
                    {canManageSettings && (
                      <SettingsDialog
                        title={t("editSchedule")}
                        triggerLabel={common("edit")}
                        triggerSize="xs"
                        successMessage={t("scheduleUpdated")}
                        fields={scheduleFields}
                        initial={{
                          name: schedule.name,
                          nameAr: schedule.nameAr,
                          startTime: schedule.startTime,
                          endTime: schedule.endTime,
                          graceMinutes: String(schedule.graceMinutes),
                          workDays: schedule.workDays.join(","),
                          isDefault: schedule.isDefault,
                          isActive: schedule.isActive,
                        }}
                        action={updateScheduleAction.bind(null, locale, schedule.id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {nav("leave")}
                </p>
                {company && canManageSettings && (
                  <SettingsDialog
                    title={t("addHoliday")}
                    triggerLabel={t("addHoliday")}
                    triggerIcon="plus"
                    triggerSize="xs"
                    successMessage={t("holidayCreated")}
                    fields={holidayFields}
                    initial={{
                      name: "",
                      nameAr: "",
                      date: new Date().toISOString().slice(0, 10),
                      year: String(new Date().getUTCFullYear()),
                      isRecurring: false,
                    }}
                    action={createHolidayAction.bind(null, locale, company.id)}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                {holidays.slice(0, 8).map((holiday) => (
                  <div key={holiday.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
                    <span className="truncate">
                      {localizedName(locale, holiday.name, holiday.nameAr)} ·{" "}
                      {formatDate(holiday.date, locale)}
                    </span>
                    {canManageSettings && (
                      <SettingsDialog
                        title={t("editHoliday")}
                        triggerLabel={common("edit")}
                        triggerSize="xs"
                        successMessage={t("holidayUpdated")}
                        fields={holidayFields}
                        initial={{
                          name: holiday.name,
                          nameAr: holiday.nameAr,
                          date: holiday.date.toISOString().slice(0, 10),
                          year: String(holiday.year ?? holiday.date.getUTCFullYear()),
                          isRecurring: holiday.isRecurring,
                        }}
                        action={updateHolidayAction.bind(null, locale, holiday.id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                {t("system")}
              </p>
              <div className="space-y-1">
                {settings.slice(0, 5).map((setting) => (
                  <div key={setting.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{setting.key}</span>
                    <span className="font-mono">{JSON.stringify(setting.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            {company && (
              <p className="text-[11px] text-muted-foreground">
                {t("currency")}: {company.currency} · {t("timezone")}: {company.timezone}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
