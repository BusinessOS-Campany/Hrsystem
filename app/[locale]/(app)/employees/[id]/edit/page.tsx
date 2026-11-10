import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeeForm } from "@/components/employees/employee-form";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requirePermission("employee.update", locale);
  const t = await getTranslations({ locale, namespace: "employees" });

  const [employee, branches, departments, positions, managers, roles] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      include: {
        employments: { where: { isCurrent: true }, take: 1 },
      },
    }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.position.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      where: {
        deletedAt: null,
        id: { not: id },
        status: { in: ["ACTIVE", "PROBATION", "ON_LEAVE"] },
      },
      orderBy: { firstName: "asc" },
      take: 300,
    }),
    prisma.role.findMany({
      where: { code: { notIn: ["SUPER_ADMIN"] } },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!employee) notFound();
  const employment = employee.employments[0];
  if (!employment) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("edit")}
        description={`${employee.employeeNo} · ${employee.firstName} ${employee.lastName}`}
      />
      <EmployeeForm
        locale={locale}
        mode="edit"
        initial={{
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          firstNameAr: employee.firstNameAr,
          lastNameAr: employee.lastNameAr,
          email: employee.email,
          phone: employee.phone,
          gender: employee.gender,
          dateOfBirth: employee.dateOfBirth?.toISOString().slice(0, 10) ?? null,
          nationality: employee.nationality,
          nationalId: employee.nationalId,
          maritalStatus: employee.maritalStatus,
          address: employee.address,
          city: employee.city,
          country: employee.country,
          emergencyName: employee.emergencyName,
          emergencyPhone: employee.emergencyPhone,
          emergencyRelation: employee.emergencyRelation,
          branchId: employment.branchId,
          departmentId: employment.departmentId,
          positionId: employment.positionId,
          managerId: employment.managerId,
          employmentType: employment.employmentType,
          hireDate: employment.hireDate.toISOString().slice(0, 10),
          basicSalary: employment.basicSalary.toString(),
        }}
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
