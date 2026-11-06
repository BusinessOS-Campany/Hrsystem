import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { DepartmentForm } from "@/components/departments/department-form";

export default async function NewDepartmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission("department.create", locale);
  const t = await getTranslations({ locale, namespace: "departments" });

  const [branches, parents, managers] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      orderBy: { firstName: "asc" },
      take: 300,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("add")} description={t("subtitle")} />
      <DepartmentForm
        locale={locale}
        branches={branches}
        parents={parents}
        managers={managers.map((manager) => ({
          id: manager.id,
          name: `${manager.firstName} ${manager.lastName}`,
          nameAr: `${manager.firstNameAr ?? ""} ${manager.lastNameAr ?? ""}`.trim(),
        }))}
      />
    </div>
  );
}
