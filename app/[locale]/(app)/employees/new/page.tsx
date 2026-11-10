import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeeForm } from "@/components/employees/employee-form";

export default async function NewEmployeePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission("employee.create", locale);
  const t = await getTranslations({ locale, namespace: "employees" });

  const [branches, departments, positions, managers, roles] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.position.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { deletedAt: null, status: { in: ["ACTIVE", "PROBATION", "ON_LEAVE"] } },
      orderBy: { firstName: "asc" },
      take: 300,
    }),
    prisma.role.findMany({
      where: { code: { notIn: ["SUPER_ADMIN"] } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("add")} description={t("subtitle")} />
      <EmployeeForm
        locale={locale}
        mode="create"
        branches={branches}
        departments={departments}
        positions={positions.map((position) => ({
          id: position.id,
          name: position.name,
          nameAr: position.nameAr,
          departmentId: position.departmentId,
        }))}
        managers={managers.map((manager) => ({
          id: manager.id,
          name: `${manager.firstName} ${manager.lastName}`,
          nameAr: `${manager.firstNameAr ?? ""} ${manager.lastNameAr ?? ""}`.trim(),
        }))}
        roles={roles.map((role) => ({
          code: role.code,
          name: role.name,
          nameAr: role.nameAr,
        }))}
      />
    </div>
  );
}
