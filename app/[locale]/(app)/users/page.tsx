import type { Prisma } from "@prisma/client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import {
  SettingsDialog,
  type SettingsField,
} from "@/components/settings/settings-dialog";
import { formatDate, formatNumber, localizedName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  UserCheck,
  UserCog,
  UserX,
} from "lucide-react";
import { createUserAction, updateUserAction } from "./actions";

const PAGE_SIZE = 20;

export default async function UsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const actor = await requirePermission("user.manage", locale);
  const t = await getTranslations({ locale, namespace: "users" });
  const common = await getTranslations({ locale, namespace: "common" });

  const actorIsSuper = actor.roles.some((role) => role.code === "SUPER_ADMIN");
  const page = Math.max(1, Number(query.page ?? "1") || 1);
  const search = query.q?.trim();

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { nameAr: { contains: search, mode: "insensitive" as const } },
            { username: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(query.role ? { roles: { some: { role: { code: query.role } } } } : {}),
    ...(query.status === "active"
      ? { isActive: true }
      : query.status === "inactive"
        ? { isActive: false }
        : {}),
  };

  const [
    users,
    total,
    roles,
    employees,
    totalUsers,
    activeUsers,
    inactiveUsers,
  ] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        roles: { include: { role: true } },
        employee: {
          select: {
            id: true,
            employeeNo: true,
            firstName: true,
            lastName: true,
            firstNameAr: true,
            lastNameAr: true,
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
    prisma.role.findMany({
      orderBy: { name: "asc" },
      select: { code: true, name: true, nameAr: true },
    }),
    prisma.employee.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        firstNameAr: true,
        lastNameAr: true,
        user: { select: { id: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, isActive: true } }),
    prisma.user.count({ where: { deletedAt: null, isActive: false } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const roleOptions = roles
    .filter((role) => actorIsSuper || role.code !== "SUPER_ADMIN")
    .map((role) => ({
      value: role.code,
      label: localizedName(locale, role.name, role.nameAr),
    }));
  const availableEmployees = employees.filter((employee) => !employee.user);
  const employeeOptions = [
    { value: "__none__", label: t("noEmployee") },
    ...availableEmployees.map((employee) => {
      const name = `${employee.firstName} ${employee.lastName}`;
      const nameAr =
        `${employee.firstNameAr ?? ""} ${employee.lastNameAr ?? ""}`.trim();
      return {
        value: employee.id,
        label: `${employee.employeeNo} · ${localizedName(locale, name, nameAr)}`,
      };
    }),
  ];

  const userErrorMessages = {
    duplicate: t("duplicate"),
    selfEdit: t("selfEdit"),
    lastAdmin: t("lastAdmin"),
    invalidRole: t("invalidRole"),
    employeeTaken: t("employeeTaken"),
    weakPassword: t("weakPassword"),
    notFound: common("error"),
    unauthorized: common("error"),
    validation: common("requiredField"),
  };

  const createFields: SettingsField[] = [
    { name: "name", label: common("name"), required: true },
    { name: "nameAr", label: common("nameAr"), dir: "rtl" },
    {
      name: "username",
      label: t("username"),
      required: true,
      dir: "ltr",
      help: t("usernameHint"),
    },
    {
      name: "email",
      label: common("email"),
      type: "email",
      required: true,
      dir: "ltr",
    },
    {
      name: "password",
      label: t("password"),
      type: "password",
      required: true,
      dir: "ltr",
      help: t("passwordHint"),
    },
    {
      name: "roleCodes",
      label: t("roles"),
      type: "checkboxes",
      required: true,
      options: roleOptions,
      colSpan: 2,
    },
    {
      name: "employeeId",
      label: t("employee"),
      type: "select",
      options: employeeOptions,
      help: t("employeeHint"),
    },
    { name: "isActive", label: t("active"), type: "switch" },
    {
      name: "mustChangePassword",
      label: t("mustChangePassword"),
      type: "switch",
    },
  ];

  const editFields: SettingsField[] = [
    { name: "name", label: common("name"), required: true },
    { name: "nameAr", label: common("nameAr"), dir: "rtl" },
    {
      name: "roleCodes",
      label: t("roles"),
      type: "checkboxes",
      required: true,
      options: roleOptions,
      colSpan: 2,
    },
    {
      name: "password",
      label: t("newPassword"),
      type: "password",
      dir: "ltr",
      help: t("passwordOptional"),
    },
    { name: "isActive", label: t("active"), type: "switch" },
    {
      name: "mustChangePassword",
      label: t("mustChangePassword"),
      type: "switch",
    },
  ];

  function pageHref(nextPage: number) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (query.role) params.set("role", query.role);
    if (query.status) params.set("status", query.status);
    if (nextPage > 1) params.set("page", String(nextPage));
    const suffix = params.toString();
    return `/users${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <SettingsDialog
            title={t("create")}
            description={t("subtitle")}
            triggerLabel={t("add")}
            triggerIcon="plus"
            successMessage={t("userCreated")}
            submitLabel={common("create")}
            wide
            fields={createFields}
            initial={{
              name: "",
              nameAr: "",
              username: "",
              email: "",
              password: "",
              roleCodes: "",
              employeeId: "__none__",
              isActive: true,
              mustChangePassword: true,
            }}
            action={createUserAction.bind(null, locale)}
            errorMessages={userErrorMessages}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("total")}
          value={formatNumber(totalUsers, locale)}
          icon={<UserCog className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("activeUsers")}
          value={formatNumber(activeUsers, locale)}
          icon={<UserCheck className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("inactiveUsers")}
          value={formatNumber(inactiveUsers, locale)}
          icon={<UserX className="size-5" />}
          tone="warning"
        />
      </div>

      <form className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={search}
            placeholder={t("searchPlaceholder")}
            className="ps-8"
          />
        </div>
        <select
          name="role"
          defaultValue={query.role ?? ""}
          className="h-9 rounded-md border bg-background px-2 text-sm"
          aria-label={t("roles")}
        >
          <option value="">{t("allRoles")}</option>
          {roleOptions.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={query.status ?? ""}
          className="h-9 rounded-md border bg-background px-2 text-sm"
          aria-label={common("status")}
        >
          <option value="">{t("allStatuses")}</option>
          <option value="active">{t("active")}</option>
          <option value="inactive">{t("inactive")}</option>
        </select>
        <Button type="submit" variant="secondary">
          {common("filter")}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/users">{common("reset")}</Link>
        </Button>
      </form>

      <div className="rounded-lg border bg-card">
        {users.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={t("noUsers")}
              icon={<UserCog className="size-5" />}
            />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{common("name")}</TableHead>
                  <TableHead>{t("roles")}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("employee")}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("lastLogin")}
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">
                    {common("createdAt")}
                  </TableHead>
                  <TableHead>{common("status")}</TableHead>
                  <TableHead className="text-end">{common("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((account) => {
                  const canEdit =
                    account.id !== actor.id &&
                    (actorIsSuper ||
                      !account.roles.some(
                        (userRole) => userRole.role.code === "SUPER_ADMIN",
                      ));
                  const employeeName = account.employee
                    ? `${account.employee.firstName} ${account.employee.lastName}`
                    : "";
                  const employeeNameAr = account.employee
                    ? `${account.employee.firstNameAr ?? ""} ${account.employee.lastNameAr ?? ""}`.trim()
                    : "";

                  return (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                              {account.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-sm font-medium">
                                {localizedName(
                                  locale,
                                  account.name,
                                  account.nameAr,
                                )}
                              </p>
                              {account.id === actor.id && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {common("self")}
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              @{account.username} · {account.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {account.roles.length > 0 ? (
                            account.roles.map((userRole) => (
                              <Badge
                                key={userRole.roleId}
                                variant="outline"
                                className="text-[10px]"
                              >
                                {localizedName(
                                  locale,
                                  userRole.role.name,
                                  userRole.role.nameAr,
                                )}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {common("notAvailable")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {account.employee ? (
                          <Link
                            href={`/employees/${account.employee.id}`}
                            className="text-sm hover:underline"
                          >
                            {localizedName(locale, employeeName, employeeNameAr)}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t("noEmployee")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                        {formatDate(account.lastLoginAt, locale, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                        {formatDate(account.createdAt, locale)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={account.isActive ? "secondary" : "outline"}
                        >
                          {account.isActive ? t("active") : t("inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end">
                        {canEdit && (
                          <SettingsDialog
                            title={t("edit")}
                            description={localizedName(
                              locale,
                              account.name,
                              account.nameAr,
                            )}
                            triggerLabel={common("edit")}
                            triggerSize="xs"
                            successMessage={t("userUpdated")}
                            fields={editFields}
                            initial={{
                              name: account.name,
                              nameAr: account.nameAr ?? "",
                              roleCodes: account.roles
                                .map((userRole) => userRole.role.code)
                                .join(","),
                              password: "",
                              isActive: account.isActive,
                              mustChangePassword: account.mustChangePassword,
                            }}
                            action={updateUserAction.bind(
                              null,
                              locale,
                              account.id,
                            )}
                            errorMessages={userErrorMessages}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {common("showing")}{" "}
                {formatNumber((page - 1) * PAGE_SIZE + 1, locale)}–
                {formatNumber(Math.min(page * PAGE_SIZE, total), locale)}{" "}
                {common("of")} {formatNumber(total, locale)}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  asChild={page > 1}
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                >
                  {page > 1 ? (
                    <Link href={pageHref(page - 1)}>
                      <ChevronLeft className="size-4" /> {common("previous")}
                    </Link>
                  ) : (
                    <span>
                      <ChevronLeft className="size-4" /> {common("previous")}
                    </span>
                  )}
                </Button>
                <Badge variant="outline">
                  {formatNumber(page, locale)} / {formatNumber(totalPages, locale)}
                </Badge>
                <Button
                  asChild={page < totalPages}
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                >
                  {page < totalPages ? (
                    <Link href={pageHref(page + 1)}>
                      {common("next")} <ChevronRight className="size-4" />
                    </Link>
                  ) : (
                    <span>
                      {common("next")} <ChevronRight className="size-4" />
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
