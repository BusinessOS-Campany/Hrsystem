import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LiveSearch } from "@/components/shared/live-search";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatNumber, localizedName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";

const PAGE_SIZE = 20;

export default async function EmployeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; department?: string; status?: string; page?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const user = await requirePermission("employee.view", locale);
  const t = await getTranslations({ locale, namespace: "employees" });
  const common = await getTranslations({ locale, namespace: "common" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const canViewAll = hasPermission(user, "employee.view_all");
  const page = Math.max(1, Number(query.page ?? "1") || 1);
  const search = query.q?.trim();

  const scope = canViewAll
    ? {}
    : user.employeeId
      ? { OR: [{ id: user.employeeId }, { managerId: user.employeeId }] }
      : { id: "__none__" };

  const where = {
    deletedAt: null,
    ...scope,
    ...(search
      ? {
          AND: [
            {
              OR: [
                { firstName: { contains: search, mode: "insensitive" as const } },
                { lastName: { contains: search, mode: "insensitive" as const } },
                { employeeNo: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
              ],
            },
          ],
        }
      : {}),
    ...(query.department
      ? { employments: { some: { isCurrent: true, departmentId: query.department } } }
      : {}),
    ...(query.status ? { status: query.status as never } : {}),
  };

  const [employees, total, departments] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        firstNameAr: true,
        lastNameAr: true,
        email: true,
        status: true,
        hireDate: true,
        employments: {
          where: { isCurrent: true },
          select: {
            department: { select: { name: true, nameAr: true } },
            position: { select: { name: true, nameAr: true } },
            branch: { select: { name: true, nameAr: true } },
          },
          take: 1,
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            firstNameAr: true,
            lastNameAr: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { employeeNo: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.employee.count({ where }),
    prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameAr: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(nextPage: number) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (query.department) params.set("department", query.department);
    if (query.status) params.set("status", query.status);
    if (nextPage > 1) params.set("page", String(nextPage));
    const suffix = params.toString();
    return `/employees${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          hasPermission(user, "employee.create") ? (
            <Button asChild>
              <Link href="/employees/new">
                <Plus className="size-4" /> {t("add")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <form className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
        <LiveSearch
          className="flex-1"
          initialValue={search}
          placeholder={t("searchPlaceholder")}
          ariaLabel={t("searchPlaceholder")}
        />
        <select
          name="department"
          defaultValue={query.department ?? ""}
          className="h-9 rounded-md border bg-background px-2 text-sm"
          aria-label={t("department")}
        >
          <option value="">{nav("departments")}</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {localizedName(locale, department.name, department.nameAr)}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={query.status ?? ""}
          className="h-9 rounded-md border bg-background px-2 text-sm"
          aria-label={t("employmentStatus")}
        >
          <option value="">{t("employmentStatus")}</option>
          {["ACTIVE", "PROBATION", "ON_LEAVE", "SUSPENDED", "RESIGNED", "TERMINATED", "RETIRED"].map(
            (status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ").toLowerCase()}
              </option>
            ),
          )}
        </select>
        <Button type="submit" variant="secondary">
          {common("filter")}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/employees">{common("reset")}</Link>
        </Button>
      </form>

      <div className="rounded-lg border bg-card">
        {employees.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={t("noEmployees")}
              icon={<Users className="size-5" />}
              action={
                hasPermission(user, "employee.create") ? (
                  <Button asChild size="sm">
                    <Link href="/employees/new">
                      <Plus className="size-4" /> {t("add")}
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fullName")}</TableHead>
                  <TableHead>{t("department")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("position")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("manager")}</TableHead>
                  <TableHead>{t("employmentStatus")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("hireDate")}</TableHead>
                  <TableHead className="text-end">{common("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => {
                  const employment = employee.employments[0];
                  const name = `${employee.firstName} ${employee.lastName}`;
                  const nameAr = `${employee.firstNameAr ?? ""} ${employee.lastNameAr ?? ""}`.trim();
                  return (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                              {employee.firstName[0]}
                              {employee.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <Link
                              href={`/employees/${employee.id}`}
                              className="block truncate text-sm font-medium hover:underline"
                            >
                              {localizedName(locale, name, nameAr)}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">
                              {employee.employeeNo} · {employee.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {employment ? (
                          <div className="space-y-0.5">
                            <p className="text-sm">
                              {localizedName(
                                locale,
                                employment.department.name,
                                employment.department.nameAr,
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {localizedName(locale, employment.branch.name, employment.branch.nameAr)}
                            </p>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {employment
                          ? localizedName(locale, employment.position.name, employment.position.nameAr)
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {employee.manager
                          ? localizedName(
                              locale,
                              `${employee.manager.firstName} ${employee.manager.lastName}`,
                              `${employee.manager.firstNameAr ?? ""} ${employee.manager.lastNameAr ?? ""}`.trim(),
                            )
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={employee.status} group="employmentStatus" />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {formatDate(employee.hireDate, locale)}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/employees/${employee.id}`}>{common("view")}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>

            <div className="divide-y md:hidden">
              {employees.map((employee) => {
                const employment = employee.employments[0];
                const name = `${employee.firstName} ${employee.lastName}`;
                const nameAr = `${employee.firstNameAr ?? ""} ${employee.lastNameAr ?? ""}`.trim();
                return (
                  <div key={employee.id} className="space-y-2.5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar className="size-9 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                            {employee.firstName[0]}
                            {employee.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link
                            href={`/employees/${employee.id}`}
                            className="block truncate text-sm font-semibold hover:underline"
                          >
                            {localizedName(locale, name, nameAr)}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {employee.employeeNo} · {employee.email}
                          </p>
                        </div>
                      </div>
                      <StatusBadge value={employee.status} group="employmentStatus" />
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <span className="text-muted-foreground">
                        {t("department")}:{" "}
                        <span className="text-foreground">
                          {employment
                            ? localizedName(
                                locale,
                                employment.department.name,
                                employment.department.nameAr,
                              )
                            : "—"}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {t("position")}:{" "}
                        <span className="text-foreground">
                          {employment
                            ? localizedName(
                                locale,
                                employment.position.name,
                                employment.position.nameAr,
                              )
                            : "—"}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {t("hireDate")}:{" "}
                        <span className="text-foreground">
                          {formatDate(employee.hireDate, locale)}
                        </span>
                      </span>
                      <span className="truncate text-muted-foreground">
                        {t("manager")}:{" "}
                        <span className="text-foreground">
                          {employee.manager
                            ? localizedName(
                                locale,
                                `${employee.manager.firstName} ${employee.manager.lastName}`,
                                `${employee.manager.firstNameAr ?? ""} ${employee.manager.lastNameAr ?? ""}`.trim(),
                              )
                            : "—"}
                        </span>
                      </span>
                    </div>
                    <Button asChild size="sm" variant="outline" className="w-full">
                      <Link href={`/employees/${employee.id}`}>{common("view")}</Link>
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {common("showing")} {formatNumber((page - 1) * PAGE_SIZE + 1, locale)}–
                {formatNumber(Math.min(page * PAGE_SIZE, total), locale)} {common("of")}{" "}
                {formatNumber(total, locale)}
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
