import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { PositionForm } from "@/components/positions/position-form";

export default async function NewPositionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission("position.create", locale);
  const t = await getTranslations({ locale, namespace: "positions" });

  const departments = await prisma.department.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("add")} description={t("subtitle")} />
      <PositionForm
        locale={locale}
        departments={departments.map((department) => ({
          id: department.id,
          name: department.name,
          nameAr: department.nameAr,
        }))}
      />
    </div>
  );
}
