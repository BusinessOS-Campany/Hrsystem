import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { CreateRunForm } from "@/components/payroll/create-run-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default async function NewPayrollRunPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission("payroll.create", locale);
  const t = await getTranslations({ locale, namespace: "payroll" });
  const common = await getTranslations({ locale, namespace: "common" });

  const periods = await prisma.payrollPeriod.findMany({
    where: { status: "OPEN", runs: { none: {} } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ms-2">
        <Link href="/payroll">
          <ArrowLeft className="size-4" /> {common("back")}
        </Link>
      </Button>
      <PageHeader title={t("createRun")} description={t("subtitle")} />
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>{t("calculate")}</CardTitle>
          <CardDescription>{t("statusFlow")}</CardDescription>
        </CardHeader>
        <CardContent>
          {periods.length === 0 ? (
            <EmptyState title={t("noOpenPeriod")} />
          ) : (
            <CreateRunForm locale={locale} periods={periods} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
